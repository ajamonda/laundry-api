import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CatalogRepository } from '../domain/catalog.repository';
import { calculatePrice } from '../domain/pricing';
import { resolveRouteCode, RouteRule } from '../domain/route-resolution';
import {
  CatalogItemDetail,
  CatalogItemSummary,
  CatalogOption,
  CatalogOptionGroup,
  CatalogPrice,
  EstimateItemInput,
  EstimateSelectedOption,
  EstimatedItem,
  EstimatedOption,
  PricingEstimate,
  PriceType,
} from '../domain/catalog.types';

const catalogItemInclude = {
  optionGroups: {
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' as const }, { displayName: 'asc' as const }],
    include: {
      options: {
        where: { active: true, parentOptionId: null },
        orderBy: [{ sortOrder: 'asc' as const }, { displayName: 'asc' as const }],
        include: {
          prices: true,
          children: {
            where: { active: true },
            orderBy: [{ sortOrder: 'asc' as const }, { displayName: 'asc' as const }],
            include: { prices: true, children: true },
          },
        },
      },
    },
  },
  inputs: {
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' as const }, { displayName: 'asc' as const }],
  },
} satisfies Prisma.CatalogItemInclude;

type CatalogItemWithRelations = Prisma.CatalogItemGetPayload<{ include: typeof catalogItemInclude }>;
type CatalogOptionGroupRow = CatalogItemWithRelations['optionGroups'][number];
type CatalogOptionRow = CatalogOptionGroupRow['options'][number];
type CatalogOptionChildRow = CatalogOptionRow['children'][number];
type CatalogPriceRow = CatalogOptionRow['prices'][number];
type CatalogItemInputRow = CatalogItemWithRelations['inputs'][number];

type CalculatedSelectedOption = EstimatedOption & {
  catalogOptionGroupId: string;
  catalogOptionId: string;
  inputValue?: string;
  quantity?: number;
  price: CatalogPrice;
};

type CalculatedItem = EstimatedItem & {
  catalogItemId: string;
  processingRouteCode: string | null;
  selectedOptions: CalculatedSelectedOption[];
  inputs?: Array<{ inputCode: string; inputValue: string }>;
  photoUrls?: string[];
};

@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveItems(): Promise<CatalogItemSummary[]> {
    const items = await this.prisma.catalogItem.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
    });

    return items.map((item) => ({
      id: item.id,
      code: item.code,
      displayName: item.displayName,
      description: item.description,
      photoRequired: item.photoRequired,
      sortOrder: item.sortOrder,
    }));
  }

  async findActiveItemByCode(code: string): Promise<CatalogItemDetail | null> {
    const item = await this.loadActiveItem(code);
    return item ? this.toCatalogItemDetail(item) : null;
  }

  async estimateItems(items: EstimateItemInput[]): Promise<PricingEstimate> {
    const calculatedItems = await this.calculateItems(items);

    return {
      estimatedMinAmount: calculatedItems.reduce(
        (sum, item) => sum + item.estimatedMinAmount,
        0,
      ),
      estimatedMaxAmount: calculatedItems.reduce(
        (sum, item) => sum + item.estimatedMaxAmount,
        0,
      ),
      items: calculatedItems.map((item) => ({
        itemCode: item.itemCode,
        displayName: item.displayName,
        estimatedMinAmount: item.estimatedMinAmount,
        estimatedMaxAmount: item.estimatedMaxAmount,
        selectedOptions: item.selectedOptions.map((option) => ({
          groupCode: option.groupCode,
          optionCode: option.optionCode,
          displayName: option.displayName,
          priceType: option.priceType,
          estimatedMinAmount: option.estimatedMinAmount,
          estimatedMaxAmount: option.estimatedMaxAmount,
        })),
      })),
    };
  }

  async createOrder(input: {
    customerId: string;
    pickupSchedule?: Date;
    fulfillmentType?: 'DELIVERY' | 'STORAGE';
    fulfillmentOptionCode?: string;
    address?: string;
    phoneNumber?: string;
    pickupDeliveryPlaceCode?: string;
    pickupDeliveryPlaceText?: string;
    secondHandPickupRequested?: boolean;
    items: EstimateItemInput[];
  }): Promise<{
    id: string;
    estimatedMinAmount: number;
    estimatedMaxAmount: number;
    createdItems: Array<{ itemId: string; routeCode: string | null }>;
  }> {
    const calculatedItems = await this.calculateItems(input.items);
    const estimatedMinAmount = calculatedItems.reduce(
      (sum, item) => sum + item.estimatedMinAmount,
      0,
    );
    const estimatedMaxAmount = calculatedItems.reduce(
      (sum, item) => sum + item.estimatedMaxAmount,
      0,
    );

    const { order, createdItems } = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { customerId: input.customerId },
        update: {
          phoneNumber: input.phoneNumber,
          address: input.address,
        },
        create: {
          customerId: input.customerId,
          phoneNumber: input.phoneNumber,
          address: input.address,
        },
      });

      const createdOrder = await tx.laundryOrder.create({
        data: {
          customerId: customer.id,
          pickupSchedule: input.pickupSchedule,
          fulfillmentType: input.fulfillmentType,
          fulfillmentOptionCode: input.fulfillmentOptionCode,
          address: input.address,
          phoneNumber: input.phoneNumber,
          pickupDeliveryPlaceCode: input.pickupDeliveryPlaceCode,
          pickupDeliveryPlaceText: input.pickupDeliveryPlaceText,
          secondHandPickupRequested:
            input.secondHandPickupRequested ?? false,
          estimatedMinAmount,
          estimatedMaxAmount,
        },
      });

      const itemResults: Array<{ itemId: string; routeCode: string | null }> = [];

      for (const item of calculatedItems) {
        const createdItem = await tx.orderItem.create({
          data: {
            orderId: createdOrder.id,
            catalogItemId: item.catalogItemId,
            catalogItemCode: item.itemCode,
            displayNameSnapshot: item.displayName,
            estimatedMinAmount: item.estimatedMinAmount,
            estimatedMaxAmount: item.estimatedMaxAmount,
          },
        });

        const optionIdByOptionCode = new Map<string, string>();

        for (const option of item.selectedOptions) {
          const createdOption = await tx.orderItemOption.create({
            data: {
              orderItemId: createdItem.id,
              catalogOptionGroupId: option.catalogOptionGroupId,
              catalogOptionId: option.catalogOptionId,
              groupCodeSnapshot: option.groupCode,
              optionCodeSnapshot: option.optionCode,
              displayNameSnapshot: option.displayName,
              inputValue: option.inputValue,
              quantity: option.quantity,
            },
          });
          optionIdByOptionCode.set(option.optionCode, createdOption.id);
        }

        for (const option of item.selectedOptions) {
          await tx.orderItemPriceSnapshot.create({
            data: {
              orderItemId: createdItem.id,
              orderItemOptionId: optionIdByOptionCode.get(option.optionCode),
              priceType: option.priceType,
              currency: option.price.currency,
              amount: option.price.amount,
              minAmount: option.price.minAmount,
              maxAmount: option.price.maxAmount,
              quantity: option.quantity,
              calculatedMinAmount: option.estimatedMinAmount,
              calculatedMaxAmount: option.estimatedMaxAmount,
            },
          });
        }

        for (const itemInput of item.inputs ?? []) {
          await tx.orderItemInput.create({
            data: {
              orderItemId: createdItem.id,
              inputCode: itemInput.inputCode,
              inputValue: itemInput.inputValue,
            },
          });
        }

        for (const [index, photoUrl] of (item.photoUrls ?? []).entries()) {
          await tx.orderItemPhoto.create({
            data: {
              orderItemId: createdItem.id,
              photoUrl,
              sortOrder: index,
            },
          });
        }

        itemResults.push({ itemId: createdItem.id, routeCode: item.processingRouteCode });
      }

      return { order: createdOrder, createdItems: itemResults };
    });

    return {
      id: order.id,
      estimatedMinAmount,
      estimatedMaxAmount,
      createdItems,
    };
  }

  private async calculateItems(items: EstimateItemInput[]): Promise<CalculatedItem[]> {
    const calculatedItems: CalculatedItem[] = [];
    const uniqueItemCodes = Array.from(new Set(items.map((i) => i.itemCode)));
    const ruleRows = uniqueItemCodes.length === 0
      ? []
      : await this.prisma.routeResolutionRule.findMany({
          where: { itemCode: { in: uniqueItemCodes } },
          orderBy: { priority: 'desc' },
        });
    const rules: RouteRule[] = ruleRows.map((r) => ({
      itemCode: r.itemCode,
      isPremium: r.isPremium,
      hasRepair: r.hasRepair,
      routeCode: r.routeCode,
      priority: r.priority,
    }));

    for (const inputItem of items) {
      const item = await this.loadActiveItem(inputItem.itemCode);
      if (!item) {
        throw new BadRequestException(
          `Invalid catalog item: ${inputItem.itemCode}`,
        );
      }

      const detail = this.toCatalogItemDetail(item);
      const selectedOptions = this.calculateSelectedOptions(
        detail,
        inputItem.options,
      );
      const estimatedMinAmount = selectedOptions.reduce(
        (sum, option) => sum + option.estimatedMinAmount,
        0,
      );
      const estimatedMaxAmount = selectedOptions.reduce(
        (sum, option) => sum + option.estimatedMaxAmount,
        0,
      );

      calculatedItems.push({
        catalogItemId: detail.id,
        processingRouteCode: resolveRouteCode(inputItem.itemCode, inputItem.options, rules),
        itemCode: detail.code,
        displayName: detail.displayName,
        estimatedMinAmount,
        estimatedMaxAmount,
        selectedOptions,
        inputs: inputItem.inputs,
        photoUrls: inputItem.photoUrls,
      });
    }

    return calculatedItems;
  }

  private calculateSelectedOptions(
    item: CatalogItemDetail,
    selectedOptions: EstimateSelectedOption[],
  ): CalculatedSelectedOption[] {
    const selectedByGroupCode = new Map<string, EstimateSelectedOption[]>();
    for (const selectedOption of selectedOptions) {
      const groupSelections =
        selectedByGroupCode.get(selectedOption.groupCode) ?? [];
      groupSelections.push(selectedOption);
      selectedByGroupCode.set(selectedOption.groupCode, groupSelections);
    }

    for (const group of item.optionGroups) {
      const groupSelections = selectedByGroupCode.get(group.code) ?? [];
      if (group.required && groupSelections.length === 0) {
        throw new BadRequestException(
          `Missing required option group: ${item.code}.${group.code}`,
        );
      }

      if (group.selectionType === 'SINGLE' && groupSelections.length > 1) {
        throw new BadRequestException(
          `Option group must be single-select: ${item.code}.${group.code}`,
        );
      }
    }

    return selectedOptions.map((selectedOption) => {
      const group = item.optionGroups.find(
        (optionGroup) => optionGroup.code === selectedOption.groupCode,
      );
      if (!group) {
        throw new BadRequestException(
          `Invalid option group: ${item.code}.${selectedOption.groupCode}`,
        );
      }

      const option = this.findOptionByCode(group.options, selectedOption.optionCode);
      if (!option) {
        throw new BadRequestException(
          `Invalid option: ${item.code}.${selectedOption.groupCode}.${selectedOption.optionCode}`,
        );
      }

      const price = option.prices[0] ?? this.emptyPrice();
      const amounts = calculatePrice(price, selectedOption.quantity);

      return {
        catalogOptionGroupId: group.id,
        catalogOptionId: option.id,
        groupCode: group.code,
        optionCode: option.code,
        displayName: option.displayName,
        priceType: price.priceType,
        estimatedMinAmount: amounts.min,
        estimatedMaxAmount: amounts.max,
        inputValue: selectedOption.inputValue,
        quantity: selectedOption.quantity,
        price,
      };
    });
  }

  private findOptionByCode(
    options: CatalogOption[],
    optionCode: string,
  ): CatalogOption | null {
    for (const option of options) {
      if (option.code === optionCode) {
        return option;
      }

      const childOption = this.findOptionByCode(option.children, optionCode);
      if (childOption) {
        return childOption;
      }
    }

    return null;
  }

  private async loadActiveItem(code: string): Promise<CatalogItemWithRelations | null> {
    return this.prisma.catalogItem.findFirst({
      where: { code, active: true },
      include: catalogItemInclude,
    });
  }

  private toCatalogItemDetail(item: CatalogItemWithRelations): CatalogItemDetail {
    return {
      id: item.id,
      code: item.code,
      displayName: item.displayName,
      description: item.description,
      photoRequired: item.photoRequired,
      sortOrder: item.sortOrder,
      optionGroups: item.optionGroups.map((group) => this.toOptionGroup(group)),
      inputs: item.inputs.map((input: CatalogItemInputRow) => ({
        id: input.id,
        code: input.code,
        displayName: input.displayName,
        inputType: input.inputType,
        required: input.required,
        sortOrder: input.sortOrder,
      })),
    };
  }

  private toOptionGroup(group: CatalogOptionGroupRow): CatalogOptionGroup {
    return {
      id: group.id,
      code: group.code,
      displayName: group.displayName,
      selectionType: group.selectionType,
      required: group.required,
      minSelect: group.minSelect,
      maxSelect: group.maxSelect,
      sortOrder: group.sortOrder,
      options: group.options.map((option) => this.toOption(option)),
    };
  }

  private toOption(option: CatalogOptionRow): CatalogOption {
    return {
      id: option.id,
      code: option.code,
      displayName: option.displayName,
      parentOptionId: option.parentOptionId,
      requiresInput: option.requiresInput,
      inputType: option.inputType,
      inputUnit: option.inputUnit,
      sortOrder: option.sortOrder,
      prices: option.prices.map(this.toPrice),
      children: option.children.map((c) => this.toChildOption(c)),
    };
  }

  // The Prisma include goes two levels deep (parent options + their direct
  // children). Third-level descendants are not loaded — seed data is at
  // most two levels nested.
  private toChildOption(option: CatalogOptionChildRow): CatalogOption {
    return {
      id: option.id,
      code: option.code,
      displayName: option.displayName,
      parentOptionId: option.parentOptionId,
      requiresInput: option.requiresInput,
      inputType: option.inputType,
      inputUnit: option.inputUnit,
      sortOrder: option.sortOrder,
      prices: option.prices.map(this.toPrice),
      children: [],
    };
  }

  private toPrice = (price: CatalogPriceRow): CatalogPrice => ({
    id: price.id,
    priceType: price.priceType,
    currency: price.currency,
    amount: price.amount,
    minAmount: price.minAmount,
    maxAmount: price.maxAmount,
    baseAmount: price.baseAmount,
    baseQuantity: price.baseQuantity?.toString() ?? null,
    baseUnit: price.baseUnit,
    extraUnitQuantity: price.extraUnitQuantity?.toString() ?? null,
    extraUnitAmount: price.extraUnitAmount,
  });

  private emptyPrice(): CatalogPrice {
    return {
      id: 'none',
      priceType: 'NONE',
      currency: 'KRW',
      amount: null,
      minAmount: null,
      maxAmount: null,
      baseAmount: null,
      baseQuantity: null,
      baseUnit: null,
      extraUnitQuantity: null,
      extraUnitAmount: null,
    };
  }
}
