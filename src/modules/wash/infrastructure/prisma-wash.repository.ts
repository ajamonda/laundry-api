import { Injectable } from '@nestjs/common';
import { OrderItemStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogger } from '../../processing-route/domain/audit-logger';
import { ActorContext, CurrentStateView } from '../../processing-route/domain/processing-route.types';
import { BagNotAtFactoryError, TagBarcodeConflictError } from '../domain/wash.errors';
import { WashRepository } from '../domain/wash.repository';
import { BagView, OrderItemsView, PackageView, ProcessingQueueItem, WashItemSelectedOption, WashItemView } from '../domain/wash.types';

@Injectable()
export class PrismaWashRepository implements WashRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLogger,
  ) {}

  async findBagWithItems(barcode: string): Promise<BagView | null> {
    const bag = await this.prisma.pickupBag.findFirst({
      where: { barcode },
      include: {
        items: {
          include: {
            orderItem: {
              include: { options: true, inputs: true },
            },
          },
        },
      },
    });

    if (!bag) return null;
    if (bag.status !== 'TAKE_BACK') throw new BagNotAtFactoryError(barcode);

    const items = await Promise.all(
      bag.items.map((bi) => this.buildItemView(bi.orderItem)),
    );

    return { bagBarcode: bag.barcode, items };
  }

  async findItem(itemId: string): Promise<WashItemView | null> {
    const item = await this.prisma.orderItem.findUnique({ where: { id: itemId } });
    if (!item) return null;
    return this.buildItemView(item);
  }

  async findOrderWithItems(orderId: string): Promise<OrderItemsView | null> {
    const order = await this.prisma.laundryOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { options: true, inputs: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) return null;

    const items = await Promise.all(order.items.map((item) => this.buildItemView(item)));

    return { orderId: order.id, items };
  }

  async attachTagBarcode(input: {
    itemId: string;
    tagBarcode: string;
    actor: ActorContext;
  }): Promise<WashItemView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const conflict = await tx.orderItem.findFirst({
        where: { tagBarcode: input.tagBarcode },
      });
      if (conflict) throw new TagBarcodeConflictError(input.tagBarcode);

      const row = await tx.orderItem.update({
        where: { id: input.itemId },
        data: { tagBarcode: input.tagBarcode, status: 'TAGGED' },
      });

      await this.auditLogger.logInTransaction(tx, {
        actor: input.actor,
        actionType: 'ITEM_TAGGED',
        targetType: 'ORDER_ITEM',
        targetId: input.itemId,
        afterState: { tagBarcode: input.tagBarcode, status: 'TAGGED' },
      });

      return row;
    });

    return this.buildItemView(updated);
  }

  async findItemByTagBarcode(tagBarcode: string): Promise<WashItemView | null> {
    const item = await this.prisma.orderItem.findFirst({
      where: { tagBarcode },
      include: { options: true, inputs: true },
    });
    if (!item) return null;
    return this.buildItemView(item);
  }

  async setItemStatus(input: { itemId: string; status: OrderItemStatus }): Promise<WashItemView> {
    const updated = await this.prisma.orderItem.update({
      where: { id: input.itemId },
      data: { status: input.status },
      include: { options: true, inputs: true },
    });
    return this.buildItemView(updated);
  }

  async findPendingRouteChange(orderItemId: string): Promise<{ id: string } | null> {
    const row = await this.prisma.routeChangeRequest.findFirst({
      where: { orderItemId, status: 'PENDING' },
      select: { id: true },
    });
    return row;
  }

  async createPackages(): Promise<PackageView[]> {
    const items = await this.prisma.orderItem.findMany({
      where: { status: OrderItemStatus.READY_TO_PACKAGE },
      select: { id: true, orderId: true, tagBarcode: true },
    });

    if (items.length === 0) return [];

    const grouped = new Map<string, { id: string; tagBarcode: string | null }[]>();
    for (const item of items) {
      const group = grouped.get(item.orderId) ?? [];
      group.push({ id: item.id, tagBarcode: item.tagBarcode });
      grouped.set(item.orderId, group);
    }

    return this.prisma.$transaction(async (tx) => {
      const results: PackageView[] = [];

      for (const [orderId, orderItems] of grouped) {
        const itemIds = orderItems.map((i) => i.id);

        const pkg = await tx.itemPackage.create({
          data: {
            orderId,
            items: { connect: itemIds.map((id) => ({ id })) },
          },
          include: { items: { select: { id: true, tagBarcode: true } } },
        });

        await tx.orderItem.updateMany({
          where: { id: { in: itemIds } },
          data: { status: OrderItemStatus.READY_FOR_DELIVERY },
        });

        results.push({
          packageId: pkg.id,
          orderId: pkg.orderId,
          items: pkg.items.map((i) => ({ itemId: i.id, tagBarcode: i.tagBarcode })),
          createdAt: pkg.createdAt,
        });
      }

      return results;
    });
  }

  private async buildItemView(item: {
    id: string;
    orderId: string;
    catalogItemCode: string;
    displayNameSnapshot: string;
    status: string;
    location: string;
    tagBarcode: string | null;
    estimatedMinAmount?: number;
    options?: { groupCodeSnapshot: string; optionCodeSnapshot: string; displayNameSnapshot: string; inputValue: string | null; quantity: unknown }[];
    inputs?: { inputCode: string; inputValue: string }[];
  }): Promise<WashItemView> {
    const processingState = await this.queryProcessingState(item.id);

    const selectedOptions: WashItemSelectedOption[] = (item.options ?? []).map((o) => ({
      groupCode: o.groupCodeSnapshot,
      optionCode: o.optionCodeSnapshot,
      displayName: o.displayNameSnapshot,
      inputValue: o.inputValue ?? null,
      quantity: o.quantity != null ? Number(o.quantity) : null,
    }));

    return {
      itemId: item.id,
      orderId: item.orderId,
      catalogItemCode: item.catalogItemCode,
      displayNameSnapshot: item.displayNameSnapshot,
      status: item.status,
      location: item.location,
      tagBarcode: item.tagBarcode,
      estimatedMinAmount: item.estimatedMinAmount ?? 0,
      processingState,
      selectedOptions,
      inputs: (item.inputs ?? []).map((i) => ({ inputCode: i.inputCode, inputValue: i.inputValue })),
    };
  }

  async findProcessingQueue(): Promise<ProcessingQueueItem[]> {
    const rows = await this.prisma.orderItem.findMany({
      where: {
        status: {
          in: [
            OrderItemStatus.SORTED,
            OrderItemStatus.PROCESSING,
            OrderItemStatus.READY_TO_PACKAGE,
          ],
        },
      },
      include: {
        processingState: {
          include: {
            plan: {
              include: {
                route: { include: { steps: { orderBy: { sortOrder: 'asc' } } } },
              },
            },
            currentRouteStep: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((item) => {
      const state = item.processingState;
      if (!state) {
        return {
          itemId: item.id,
          orderId: item.orderId,
          tagBarcode: item.tagBarcode,
          displayNameSnapshot: item.displayNameSnapshot,
          status: item.status,
          routeCode: '',
          currentStep: null,
          nextStep: null,
          isPlanCompleted: false,
        };
      }

      const currentStep = state.currentRouteStep
        ? {
            stepType: state.currentRouteStep.stepType,
            displayName: state.currentRouteStep.displayName,
            sortOrder: state.currentRouteStep.sortOrder,
            status: state.currentStepStatus,
          }
        : null;

      const currentSortOrder = state.currentRouteStep?.sortOrder ?? -Infinity;
      const nextStepRow =
        state.plan.route.steps.find((s) => s.sortOrder > currentSortOrder) ?? null;

      return {
        itemId: item.id,
        orderId: item.orderId,
        tagBarcode: item.tagBarcode,
        displayNameSnapshot: item.displayNameSnapshot,
        status: item.status,
        routeCode: state.plan.route.code,
        currentStep,
        nextStep: nextStepRow
          ? {
              stepType: nextStepRow.stepType,
              displayName: nextStepRow.displayName,
              sortOrder: nextStepRow.sortOrder,
            }
          : null,
        isPlanCompleted: state.currentStepStatus === 'COMPLETED',
      };
    });
  }

  private async queryProcessingState(orderItemId: string): Promise<CurrentStateView | null> {
    const state = await this.prisma.itemProcessingState.findUnique({
      where: { orderItemId },
      include: {
        plan: { include: { route: true } },
        currentRouteStep: true,
        currentOverride: true,
      },
    });
    if (!state) return null;

    const isOverride = state.currentStepSource === 'OVERRIDE';
    const currentOverride = state.currentOverride;
    const currentSortOrder = isOverride
      ? (currentOverride?.sortOrder ?? 0)
      : (state.currentRouteStep?.sortOrder ?? 0);

    let nextStep: { id: string; stepType: string; displayName: string; sortOrder: number } | null = null;
    if (isOverride && currentOverride) {
      const template = await this.prisma.exceptionFlowTemplate.findFirst({
        where: { code: currentOverride.flowCode, active: true },
        include: { steps: { orderBy: { offset: 'asc' } } },
      });
      const nextTemplateStep = template?.steps.find((s) => s.offset > currentOverride.currentOffset) ?? null;
      if (nextTemplateStep) {
        nextStep = {
          id: currentOverride.id,
          stepType: nextTemplateStep.stepType,
          displayName: nextTemplateStep.displayName,
          sortOrder: currentOverride.baseStepSortOrder + nextTemplateStep.offset,
        };
      }
    } else if (!isOverride && state.currentRouteStep) {
      nextStep = await this.prisma.processingRouteStep.findFirst({
        where: { routeId: state.plan.routeId, sortOrder: { gt: currentSortOrder } },
        orderBy: { sortOrder: 'asc' },
      });
    }

    const currentStep = isOverride && currentOverride
      ? {
          stepId: currentOverride.id,
          stepType: currentOverride.stepType,
          displayName: currentOverride.displayName,
          sortOrder: currentOverride.sortOrder,
          status: state.currentStepStatus,
        }
      : state.currentRouteStep
        ? {
            stepId: state.currentRouteStep.id,
            stepType: state.currentRouteStep.stepType,
            displayName: state.currentRouteStep.displayName,
            sortOrder: state.currentRouteStep.sortOrder,
            status: state.currentStepStatus,
          }
        : null;

    return {
      orderItemId,
      planId: state.planId,
      routeCode: state.plan.route.code,
      currentStepSource: state.currentStepSource,
      currentStep,
      nextStep: nextStep
        ? {
            stepId: nextStep.id,
            stepType: nextStep.stepType,
            displayName: nextStep.displayName,
            sortOrder: nextStep.sortOrder,
          }
        : null,
      isPlanCompleted: state.currentStepStatus === 'COMPLETED',
    };
  }
}
