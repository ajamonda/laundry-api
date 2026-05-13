import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

export class BagNotAtFactoryError extends BadRequestException {
  constructor(barcode: string) {
    super(`Bag is not at factory (TAKE_BACK): ${barcode}`);
  }
}

export class ItemNotTaggableError extends ConflictException {
  constructor(itemId: string) {
    super(`Item must be PICK_UP and IN_HOUSE to attach a tag: ${itemId}`);
  }
}

export class ItemNotAssignableError extends ConflictException {
  constructor(itemId: string) {
    super(`Item must be TAGGED to assign a route: ${itemId}`);
  }
}

export class ItemNotScannable extends ConflictException {
  constructor(itemId: string) {
    super(`Item must be SORTED or PROCESSING to scan a step: ${itemId}`);
  }
}

export class ItemAwaitingCustomerDecision extends ConflictException {
  constructor(itemId: string) {
    super(`Item is awaiting customer decision and cannot be scanned: ${itemId}`);
  }
}

export class ItemHasPendingRouteChange extends ConflictException {
  constructor(itemId: string) {
    super(`Item has a pending route change request and cannot be scanned: ${itemId}`);
  }
}

export class TagBarcodeConflictError extends ConflictException {
  constructor(tagBarcode: string) {
    super(`Tag barcode is already in use: ${tagBarcode}`);
  }
}

export class WashItemNotFoundError extends NotFoundException {
  constructor(itemId: string) {
    super(`Item not found: ${itemId}`);
  }
}

export class WashBagNotFoundError extends NotFoundException {
  constructor(barcode: string) {
    super(`Pickup bag not found: ${barcode}`);
  }
}

export class WashOrderNotFoundError extends NotFoundException {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`);
  }
}

export class TagNotFoundError extends NotFoundException {
  constructor(tagBarcode: string) {
    super(`No item is registered with tag: ${tagBarcode}`);
  }
}
