import { ConflictException, Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditLogger } from '../../processing-route/domain/audit-logger';
import { ActorContext } from '../../processing-route/domain/processing-route.types';
import { DeliveryVehicleNotFoundError } from '../domain/delivery.errors';
import { DeliveryRepository } from '../domain/delivery.repository';
import {
  DeliveryPackageView,
  DeliveryRunView,
  DeliveryVehicleView,
  HandoffPhotoView,
  PackageHandoffResult,
  PackageScanOutboundResult,
} from '../domain/delivery.types';

@Injectable()
export class PrismaDeliveryRepository implements DeliveryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLogger,
  ) {}

  async findActiveVehicles(): Promise<DeliveryVehicleView[]> {
    const vehicles = await this.prisma.deliveryVehicle.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
      select: { code: true, displayName: true },
    });
    return vehicles.map((v) => ({ code: v.code, displayName: v.displayName }));
  }

  async findDeliveryPackages(): Promise<DeliveryPackageView[]> {
    const packages = await this.prisma.itemPackage.findMany({
      where: { items: { some: { status: 'READY_FOR_DELIVERY' } } },
      include: {
        order: {
          select: {
            address: true,
            phoneNumber: true,
            fulfillmentType: true,
            fulfillmentOptionCode: true,
            pickupDeliveryPlaceCode: true,
            pickupDeliveryPlaceText: true,
          },
        },
        items: {
          where: { status: 'READY_FOR_DELIVERY' },
          select: {
            id: true,
            tagBarcode: true,
            catalogItemCode: true,
            displayNameSnapshot: true,
            status: true,
          },
        },
        handoffPhoto: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return packages.map((pkg) => this.toPackageView(pkg));
  }

  async findLoadedPackages(runId: string): Promise<DeliveryPackageView[]> {
    const packages = await this.prisma.itemPackage.findMany({
      where: {
        items: {
          some: {
            status: 'DELIVERING',
            deliveryRunItem: { runId },
          },
        },
      },
      include: {
        order: {
          select: {
            address: true,
            phoneNumber: true,
            fulfillmentType: true,
            fulfillmentOptionCode: true,
            pickupDeliveryPlaceCode: true,
            pickupDeliveryPlaceText: true,
          },
        },
        items: {
          where: {
            status: 'DELIVERING',
            deliveryRunItem: { runId },
          },
          select: {
            id: true,
            tagBarcode: true,
            catalogItemCode: true,
            displayNameSnapshot: true,
            status: true,
          },
        },
        handoffPhoto: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return packages.map((pkg) => this.toPackageView(pkg));
  }

  async findPackageById(packageId: string): Promise<DeliveryPackageView | null> {
    const pkg = await this.prisma.itemPackage.findUnique({
      where: { id: packageId },
      include: {
        order: {
          select: {
            address: true,
            phoneNumber: true,
            fulfillmentType: true,
            fulfillmentOptionCode: true,
            pickupDeliveryPlaceCode: true,
            pickupDeliveryPlaceText: true,
          },
        },
        items: {
          select: {
            id: true,
            tagBarcode: true,
            catalogItemCode: true,
            displayNameSnapshot: true,
            status: true,
          },
        },
        handoffPhoto: true,
      },
    });
    return pkg ? this.toPackageView(pkg) : null;
  }

  async findActiveRun(staffId: string): Promise<DeliveryRunView | null> {
    const run = await this.prisma.deliveryRun.findFirst({
      where: { staffId, status: 'ACTIVE' },
      include: { vehicle: true },
    });
    return run ? this.toRunView(run) : null;
  }

  async findRunById(runId: string): Promise<DeliveryRunView | null> {
    const run = await this.prisma.deliveryRun.findUnique({
      where: { id: runId },
      include: { vehicle: true },
    });
    return run ? this.toRunView(run) : null;
  }

  async createRun(input: { staffId: string; vehicleCode: string }): Promise<DeliveryRunView> {
    return this.prisma.$transaction(async (tx) => {
      const vehicle = await tx.deliveryVehicle.findFirst({
        where: { code: input.vehicleCode, active: true },
      });
      if (!vehicle) throw new DeliveryVehicleNotFoundError(input.vehicleCode);

      const existingRun = await tx.deliveryRun.findFirst({
        where: { staffId: input.staffId, status: 'ACTIVE' },
        include: { vehicle: true },
      });
      if (existingRun?.vehicleId === vehicle.id) return this.toRunView(existingRun);
      if (existingRun) throw new ConflictException('Staff already has an active delivery run.');

      const vehicleInUse = await tx.deliveryRun.findFirst({
        where: { vehicleId: vehicle.id, status: 'ACTIVE' },
      });
      if (vehicleInUse) throw new ConflictException('Delivery vehicle is already in use.');

      const run = await tx.deliveryRun.create({
        data: { staffId: input.staffId, vehicleId: vehicle.id },
        include: { vehicle: true },
      });
      return this.toRunView(run);
    });
  }

  async closeRun(runId: string): Promise<DeliveryRunView> {
    const run = await this.prisma.deliveryRun.update({
      where: { id: runId },
      data: { status: 'CLOSED', closedAt: new Date() },
      include: { vehicle: true },
    });
    return this.toRunView(run);
  }

  async countWaitingBillings(orderId: string): Promise<number> {
    // BASE + SUPPLEMENT 구분 없이 모든 미결제 row를 셈. 한 건이라도 WAITING이면
    // 출고 차단.
    return this.prisma.billingRequest.count({
      where: { orderId, status: 'WAITING' },
    });
  }

  async scanOutbound(input: { packageId: string; runId: string; actor: ActorContext }): Promise<PackageScanOutboundResult> {
    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.itemPackage.findUnique({
        where: { id: input.packageId },
        include: { items: { select: { id: true } } },
      });
      const itemIds = pkg!.items.map((i) => i.id);

      await tx.orderItem.updateMany({
        where: { id: { in: itemIds } },
        data: { status: 'DELIVERING', location: 'DELIVERING_TRUCK' },
      });

      await tx.deliveryRunItem.createMany({
        data: itemIds.map((id) => ({ runId: input.runId, orderItemId: id })),
      });

      for (const itemId of itemIds) {
        await this.auditLogger.logInTransaction(tx, {
          actor: input.actor,
          actionType: 'ITEM_SCAN_OUTBOUND',
          targetType: 'ORDER_ITEM',
          targetId: itemId,
          afterState: { status: 'DELIVERING', location: 'DELIVERING_TRUCK' },
        });
      }

      return {
        packageId: input.packageId,
        orderId: pkg!.orderId,
        items: itemIds.map((id) => ({ itemId: id, status: 'DELIVERING', location: 'DELIVERING_TRUCK' })),
      };
    });
  }

  async handoffPackage(input: { packageId: string; actor: ActorContext }): Promise<PackageHandoffResult> {
    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.itemPackage.findUnique({
        where: { id: input.packageId },
        include: { items: { select: { id: true, orderId: true } } },
      });
      const itemIds = pkg!.items.map((i) => i.id);
      const orderId = pkg!.orderId;

      await tx.orderItem.updateMany({
        where: { id: { in: itemIds } },
        data: { status: 'FINISHED', location: 'CUSTOMER_DEST' },
      });

      for (const itemId of itemIds) {
        await this.auditLogger.logInTransaction(tx, {
          actor: input.actor,
          actionType: 'ITEM_HANDED_OFF',
          targetType: 'ORDER_ITEM',
          targetId: itemId,
          afterState: { status: 'FINISHED', location: 'CUSTOMER_DEST' },
        });
      }

      const allItems = await tx.orderItem.findMany({
        where: { orderId },
        select: { status: true },
      });

      const allFinished = allItems.every((i) => i.status === 'FINISHED');
      const someFinished = allItems.some((i) => i.status === 'FINISHED');
      const newOrderStatus: OrderStatus | null = allFinished
        ? OrderStatus.FINISHED
        : someFinished
          ? OrderStatus.PARTIAL_FINISHED
          : null;

      if (newOrderStatus) {
        await tx.laundryOrder.update({
          where: { id: orderId },
          data: { status: newOrderStatus },
        });
      }

      return {
        packageId: input.packageId,
        orderId,
        items: itemIds.map((id) => ({ itemId: id, status: 'FINISHED', location: 'CUSTOMER_DEST' })),
        orderStatus: newOrderStatus ?? 'PROCESSING',
      };
    });
  }

  async recordHandoffPhoto(input: { packageId: string; url: string }): Promise<HandoffPhotoView> {
    const photo = await this.prisma.deliveryHandoffPhoto.upsert({
      where: { packageId: input.packageId },
      create: { packageId: input.packageId, url: input.url },
      update: { url: input.url },
    });
    return {
      id: photo.id,
      packageId: photo.packageId,
      url: photo.url,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt,
    };
  }

  private toPackageView(pkg: {
    id: string;
    orderId: string;
    order: {
      address: string | null;
      phoneNumber: string | null;
      fulfillmentType: string | null;
      fulfillmentOptionCode: string | null;
      pickupDeliveryPlaceCode: string | null;
      pickupDeliveryPlaceText: string | null;
    };
    items: {
      id: string;
      tagBarcode: string | null;
      catalogItemCode: string;
      displayNameSnapshot: string;
      status: string;
    }[];
    handoffPhoto: {
      id: string;
      packageId: string;
      url: string;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }): DeliveryPackageView {
    return {
      packageId: pkg.id,
      orderId: pkg.orderId,
      address: pkg.order.address,
      phoneNumber: pkg.order.phoneNumber,
      fulfillmentType: pkg.order.fulfillmentType,
      fulfillmentOptionCode: pkg.order.fulfillmentOptionCode,
      pickupDeliveryPlaceCode: pkg.order.pickupDeliveryPlaceCode,
      pickupDeliveryPlaceText: pkg.order.pickupDeliveryPlaceText,
      items: pkg.items.map((i) => ({
        itemId: i.id,
        tagBarcode: i.tagBarcode,
        catalogItemCode: i.catalogItemCode,
        displayNameSnapshot: i.displayNameSnapshot,
        status: i.status,
      })),
      handoffPhoto: pkg.handoffPhoto
        ? {
            id: pkg.handoffPhoto.id,
            packageId: pkg.handoffPhoto.packageId,
            url: pkg.handoffPhoto.url,
            createdAt: pkg.handoffPhoto.createdAt,
            updatedAt: pkg.handoffPhoto.updatedAt,
          }
        : null,
    };
  }

  private toRunView(run: {
    id: string;
    staffId: string;
    status: string;
    createdAt: Date;
    closedAt: Date | null;
    vehicle: { code: string; displayName: string };
  }): DeliveryRunView {
    return {
      id: run.id,
      staffId: run.staffId,
      vehicleCode: run.vehicle.code,
      vehicleDisplayName: run.vehicle.displayName,
      status: run.status,
      createdAt: run.createdAt,
      closedAt: run.closedAt,
    };
  }
}
