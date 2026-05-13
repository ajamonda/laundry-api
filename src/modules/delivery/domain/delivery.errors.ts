import { HttpStatus } from '@nestjs/common';
import { DomainError } from '../../../common/errors/domain-error';

export class DeliveryItemNotFoundError extends DomainError {
  readonly code = 'DELIVERY_ITEM_NOT_FOUND';
  constructor(tag: string) {
    super(`No item found with tag: ${tag}`, HttpStatus.NOT_FOUND);
  }
}

export class ItemNotDeliverableError extends DomainError {
  readonly code = 'DELIVERY_ITEM_NOT_DELIVERABLE';
  constructor(itemId: string, status: string) {
    super(`Item ${itemId} cannot be scanned for outbound (status: ${status})`, HttpStatus.CONFLICT);
  }
}

export class ItemNotHandoffableError extends DomainError {
  readonly code = 'DELIVERY_ITEM_NOT_HANDOFFABLE';
  constructor(itemId: string, status: string) {
    super(`Item ${itemId} cannot be handed off (status: ${status})`, HttpStatus.CONFLICT);
  }
}

export class BillingNotPaidError extends DomainError {
  readonly code = 'DELIVERY_BILLING_NOT_PAID';
  constructor(orderId: string) {
    super(`Order ${orderId} has unpaid billing. Complete payment before outbound scan.`, HttpStatus.CONFLICT);
  }
}

export class ActiveRunNotFoundError extends DomainError {
  readonly code = 'DELIVERY_ACTIVE_RUN_NOT_FOUND';
  constructor() {
    super('No active delivery run found for this staff. Register a run first.', HttpStatus.NOT_FOUND);
  }
}

export class DeliveryRunNotFoundError extends DomainError {
  readonly code = 'DELIVERY_RUN_NOT_FOUND';
  constructor(runId: string) {
    super(`Delivery run not found: ${runId}`, HttpStatus.NOT_FOUND);
  }
}

export class DeliveryVehicleNotFoundError extends DomainError {
  readonly code = 'DELIVERY_VEHICLE_NOT_FOUND';
  constructor(code: string) {
    super(`Delivery vehicle not found or inactive: ${code}`, HttpStatus.NOT_FOUND);
  }
}

export class PackageNotFoundError extends DomainError {
  readonly code = 'DELIVERY_PACKAGE_NOT_FOUND';
  constructor(packageId: string) {
    super(`Package not found: ${packageId}`, HttpStatus.NOT_FOUND);
  }
}

export class PackageNotDeliverableError extends DomainError {
  readonly code = 'DELIVERY_PACKAGE_NOT_DELIVERABLE';
  constructor(packageId: string) {
    super(`Package ${packageId} items are not all in READY_FOR_DELIVERY status`, HttpStatus.CONFLICT);
  }
}

export class PackageNotHandoffableError extends DomainError {
  readonly code = 'DELIVERY_PACKAGE_NOT_HANDOFFABLE';
  constructor(packageId: string) {
    super(`Package ${packageId} items are not all in DELIVERING status`, HttpStatus.CONFLICT);
  }
}
