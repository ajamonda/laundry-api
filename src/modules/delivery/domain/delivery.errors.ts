import { ConflictException, NotFoundException } from '@nestjs/common';

export class DeliveryItemNotFoundError extends NotFoundException {
  constructor(tag: string) {
    super(`No item found with tag: ${tag}`);
  }
}

export class ItemNotDeliverableError extends ConflictException {
  constructor(itemId: string, status: string) {
    super(`Item ${itemId} cannot be scanned for outbound (status: ${status})`);
  }
}

export class ItemNotHandoffableError extends ConflictException {
  constructor(itemId: string, status: string) {
    super(`Item ${itemId} cannot be handed off (status: ${status})`);
  }
}

export class BillingNotPaidError extends ConflictException {
  constructor(orderId: string) {
    super(`Order ${orderId} has unpaid billing. Complete payment before outbound scan.`);
  }
}

export class ActiveRunNotFoundError extends NotFoundException {
  constructor() {
    super('No active delivery run found for this staff. Register a run first.');
  }
}

export class DeliveryRunNotFoundError extends NotFoundException {
  constructor(runId: string) {
    super(`Delivery run not found: ${runId}`);
  }
}

export class DeliveryVehicleNotFoundError extends NotFoundException {
  constructor(code: string) {
    super(`Delivery vehicle not found or inactive: ${code}`);
  }
}

export class PackageNotFoundError extends NotFoundException {
  constructor(packageId: string) {
    super(`Package not found: ${packageId}`);
  }
}

export class PackageNotDeliverableError extends ConflictException {
  constructor(packageId: string) {
    super(`Package ${packageId} items are not all in READY_FOR_DELIVERY status`);
  }
}

export class PackageNotHandoffableError extends ConflictException {
  constructor(packageId: string) {
    super(`Package ${packageId} items are not all in DELIVERING status`);
  }
}
