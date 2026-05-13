import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PickupRepository } from '../domain/pickup.repository';
import {
  PaginatedPickupRequests,
  PickupBagResult,
  PickupContainmentResult,
  PickupHandoffResult,
  PickupPhotoResult,
  PickupRequestDetail,
  PickupRunResult,
} from '../domain/pickup.types';

@Injectable()
export class PrismaPickupRepository implements PickupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRequestPage(input: {
    page: number;
    pageSize: number;
  }): Promise<PaginatedPickupRequests> {
    const skip = (input.page - 1) * input.pageSize;
    const [orders, totalCount] = await this.prisma.$transaction([
      this.prisma.laundryOrder.findMany({
        where: { status: 'REQUEST' },
        orderBy: [{ pickupSchedule: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: input.pageSize,
        include: {
          customer: true,
          _count: { select: { items: true } },
        },
      }),
      this.prisma.laundryOrder.count({ where: { status: 'REQUEST' } }),
    ]);

    return {
      items: orders.map((order) => ({
        orderId: order.id,
        customerId: order.customer.customerId,
        pickupSchedule: order.pickupSchedule,
        address: order.address,
        phoneNumber: order.phoneNumber,
        pickupDeliveryPlaceCode: order.pickupDeliveryPlaceCode,
        pickupDeliveryPlaceText: order.pickupDeliveryPlaceText,
        secondHandPickupRequested: order.secondHandPickupRequested,
        status: 'REQUEST',
        itemCount: order._count.items,
        createdAt: order.createdAt,
      })),
      page: input.page,
      pageSize: input.pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / input.pageSize),
    };
  }

  async findRequestDetail(orderId: string): Promise<PickupRequestDetail | null> {
    const order = await this.prisma.laundryOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            options: true,
            inputs: true,
            photos: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) return null;

    return {
      orderId: order.id,
      customerId: order.customer.customerId,
      status: order.status,
      pickupSchedule: order.pickupSchedule,
      address: order.address,
      phoneNumber: order.phoneNumber,
      fulfillmentType: order.fulfillmentType,
      fulfillmentOptionCode: order.fulfillmentOptionCode,
      pickupDeliveryPlaceCode: order.pickupDeliveryPlaceCode,
      pickupDeliveryPlaceText: order.pickupDeliveryPlaceText,
      secondHandPickupRequested: order.secondHandPickupRequested,
      items: order.items.map((item) => ({
        itemId: item.id,
        catalogItemCode: item.catalogItemCode,
        displayNameSnapshot: item.displayNameSnapshot,
        status: item.status,
        location: item.location,
        options: item.options.map((o) => ({
          groupCodeSnapshot: o.groupCodeSnapshot,
          optionCodeSnapshot: o.optionCodeSnapshot,
          displayNameSnapshot: o.displayNameSnapshot,
        })),
        inputs: item.inputs.map((i) => ({
          inputCode: i.inputCode,
          inputValue: i.inputValue,
        })),
        photoUrls: item.photos.map((p) => p.photoUrl),
      })),
    };
  }

  async createRun(input: {
    staffId: string;
    vehicleCode: string;
  }): Promise<PickupRunResult> {
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.pickupVehicle.findFirst({
        where: { code: input.vehicleCode, active: true },
      });
      if (!vehicle) {
        throw new BadRequestException('Active pickup vehicle was not found.');
      }

      const staff = await tx.staff.findUnique({
        where: { staffId: input.staffId },
      });
      if (!staff) {
        throw new BadRequestException('Pickup staff was not found.');
      }

      const existingStaffRun = await tx.pickupRun.findFirst({
        where: { staffId: input.staffId, status: 'ACTIVE' },
        include: { vehicle: true },
      });
      if (existingStaffRun?.vehicleId === vehicle.id) {
        return this.toRunResult(existingStaffRun);
      }
      if (existingStaffRun) {
        throw new ConflictException('Staff already has an active pickup run.');
      }

      const existingVehicleRun = await tx.pickupRun.findFirst({
        where: { vehicleId: vehicle.id, status: 'ACTIVE' },
      });
      if (existingVehicleRun) {
        throw new ConflictException('Pickup vehicle is already in use.');
      }

      const run = await tx.pickupRun.create({
        data: {
          vehicleId: vehicle.id,
          staffId: input.staffId,
        },
        include: { vehicle: true },
      });

      return this.toRunResult(run);
    });
  }

  async registerBag(input: {
    staffId: string;
    runId: string;
    bagBarcode: string;
  }): Promise<PickupBagResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.loadActiveRunForStaff(tx, input.runId, input.staffId);

      const bag = await tx.pickupBag.findFirst({
        where: { barcode: input.bagBarcode, active: true },
      });
      if (!bag) {
        throw new BadRequestException('Active pickup bag was not found.');
      }
      if (bag.status !== 'READY') {
        throw new ConflictException('Pickup bag must be READY.');
      }

      const updatedBag = await tx.pickupBag.update({
        where: { id: bag.id },
        data: {
          status: 'TAKE_OUT',
          currentRunId: input.runId,
        },
      });

      return this.toBagResult(updatedBag);
    });
  }

  async recordPickupPhoto(input: {
    staffId: string;
    runId: string;
    orderId: string;
    photoUrl: string;
  }): Promise<PickupPhotoResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.loadActiveRunForStaff(tx, input.runId, input.staffId);

      const order = await tx.laundryOrder.findUnique({
        where: { id: input.orderId },
      });
      if (!order) {
        throw new NotFoundException('Pickup request order was not found.');
      }

      const photo = await tx.pickupPhoto.create({
        data: {
          orderId: input.orderId,
          pickupRunId: input.runId,
          staffId: input.staffId,
          photoUrl: input.photoUrl,
        },
      });

      return {
        photoId: photo.id,
        orderId: photo.orderId,
        runId: photo.pickupRunId,
        staffId: photo.staffId,
        photoUrl: photo.photoUrl,
        createdAt: photo.createdAt,
      };
    });
  }

  async putItemsIntoBag(input: {
    staffId: string;
    runId: string;
    orderId: string;
    bagBarcode: string;
    itemIds: string[];
  }): Promise<PickupContainmentResult> {
    return this.prisma.$transaction(async (tx) => {
      await this.loadActiveRunForStaff(tx, input.runId, input.staffId);
      const uniqueItemIds = [...new Set(input.itemIds)];
      if (uniqueItemIds.length !== input.itemIds.length || uniqueItemIds.length === 0) {
        throw new BadRequestException('Item ids must be unique and non-empty.');
      }

      const bag = await tx.pickupBag.findFirst({
        where: {
          barcode: input.bagBarcode,
          active: true,
          currentRunId: input.runId,
        },
      });
      if (!bag) {
        throw new BadRequestException('Pickup bag is not registered to this run.');
      }
      if (bag.status !== 'TAKE_OUT') {
        throw new ConflictException('Pickup bag must be TAKE_OUT.');
      }

      const photoCount = await tx.pickupPhoto.count({
        where: { orderId: input.orderId, pickupRunId: input.runId },
      });
      if (photoCount === 0) {
        throw new BadRequestException('Pickup photo is required before bag containment.');
      }

      const order = await tx.laundryOrder.findUnique({
        where: { id: input.orderId },
        include: { items: true },
      });
      if (!order) {
        throw new NotFoundException('Pickup request order was not found.');
      }
      if (order.status !== 'REQUEST') {
        throw new ConflictException('Order must be REQUEST.');
      }

      const orderItemIds = order.items.map((item) => item.id).sort();
      const requestedItemIds = [...uniqueItemIds].sort();
      if (orderItemIds.join('|') !== requestedItemIds.join('|')) {
        throw new BadRequestException('MVP pickup requires all order items.');
      }

      for (const item of order.items) {
        if (item.status !== 'INIT' || item.location !== 'CUSTOMER_PICK_UP') {
          throw new ConflictException(
            'Order items must be INIT and CUSTOMER_PICK_UP.',
          );
        }
      }

      const alreadyContained = await tx.pickupBagItem.count({
        where: { orderItemId: { in: uniqueItemIds } },
      });
      if (alreadyContained > 0) {
        throw new ConflictException('One or more items are already in a pickup bag.');
      }

      await tx.pickupBagItem.createMany({
        data: uniqueItemIds.map((itemId) => ({
          pickupBagId: bag.id,
          pickupRunId: input.runId,
          orderId: input.orderId,
          orderItemId: itemId,
        })),
      });
      await tx.orderItem.updateMany({
        where: { id: { in: uniqueItemIds } },
        data: {
          status: 'PICK_UP',
          location: 'PICK_UP_TRUCK',
        },
      });
      await tx.laundryOrder.update({
        where: { id: input.orderId },
        data: { status: 'PICK_UP' },
      });
      const updatedBag = await tx.pickupBag.update({
        where: { id: bag.id },
        data: { status: 'CONTAIN' },
      });

      return {
        runId: input.runId,
        bag: this.toBagResult(updatedBag),
        order: {
          orderId: input.orderId,
          status: 'PICK_UP',
        },
        items: uniqueItemIds.map((itemId) => ({
          itemId,
          status: 'PICK_UP',
          location: 'PICK_UP_TRUCK',
        })),
      };
    });
  }

  async handoffBag(input: {
    staffId: string;
    runId: string;
    bagBarcode: string;
  }): Promise<PickupHandoffResult> {
    return this.prisma.$transaction(async (tx) => {
      const run = await this.loadActiveRunForStaff(tx, input.runId, input.staffId);
      const bag = await tx.pickupBag.findFirst({
        where: {
          barcode: input.bagBarcode,
          active: true,
          currentRunId: run.id,
        },
      });
      if (!bag) {
        throw new BadRequestException('Pickup bag is not registered to this run.');
      }
      if (bag.status !== 'CONTAIN') {
        throw new ConflictException('Pickup bag must be CONTAIN.');
      }

      const containedItems = await tx.pickupBagItem.findMany({
        where: { pickupBagId: bag.id, pickupRunId: run.id },
        include: { orderItem: true },
      });
      if (containedItems.length === 0) {
        throw new ConflictException('Pickup bag has no contained items.');
      }

      for (const containedItem of containedItems) {
        if (
          containedItem.orderItem.status !== 'PICK_UP' ||
          containedItem.orderItem.location !== 'PICK_UP_TRUCK'
        ) {
          throw new ConflictException(
            'Contained items must be PICK_UP and PICK_UP_TRUCK.',
          );
        }
      }

      const itemIds = containedItems.map((item) => item.orderItemId);
      const orderIds = [...new Set(containedItems.map((item) => item.orderId))];

      await tx.orderItem.updateMany({
        where: { id: { in: itemIds } },
        data: { location: 'IN_HOUSE' },
      });
      await tx.laundryOrder.updateMany({
        where: { id: { in: orderIds }, status: 'PICK_UP' },
        data: { status: 'PROCESSING' },
      });
      const updatedBag = await tx.pickupBag.update({
        where: { id: bag.id },
        data: { status: 'TAKE_BACK' },
      });

      const remainingOpenBags = await tx.pickupBag.count({
        where: {
          currentRunId: run.id,
          status: { not: 'TAKE_BACK' },
        },
      });
      const updatedRun =
        remainingOpenBags === 0
          ? await tx.pickupRun.update({
              where: { id: run.id },
              data: {
                status: 'RETURNED',
                endedAt: new Date(),
              },
            })
          : run;

      return {
        runId: run.id,
        runStatus: updatedRun.status,
        bag: this.toBagResult(updatedBag),
        orders: orderIds.map((orderId) => ({
          orderId,
          status: 'PROCESSING',
        })),
        items: itemIds.map((itemId) => ({
          itemId,
          status: 'PICK_UP',
          location: 'IN_HOUSE',
        })),
      };
    });
  }

  private async loadActiveRunForStaff(
    tx: Prisma.TransactionClient,
    runId: string,
    staffId: string,
  ) {
    const run = await tx.pickupRun.findFirst({
      where: {
        id: runId,
        staffId,
        status: 'ACTIVE',
      },
    });
    if (!run) {
      throw new BadRequestException('Active pickup run was not found.');
    }

    return run;
  }

  private toRunResult(run: {
    id: string;
    staffId: string;
    status: 'ACTIVE' | 'RETURNED';
    startedAt: Date;
    vehicle: {
      code: string;
      displayName: string;
    };
  }): PickupRunResult {
    return {
      runId: run.id,
      vehicle: {
        code: run.vehicle.code,
        displayName: run.vehicle.displayName,
      },
      staffId: run.staffId,
      status: run.status,
      startedAt: run.startedAt,
    };
  }

  private toBagResult(bag: {
    id: string;
    barcode: string;
    status: 'READY' | 'TAKE_OUT' | 'CONTAIN' | 'TAKE_BACK';
    currentRunId: string | null;
  }): PickupBagResult {
    return {
      bagId: bag.id,
      barcode: bag.barcode,
      status: bag.status,
      runId: bag.currentRunId,
    };
  }
}
