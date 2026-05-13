import { HttpStatus } from '@nestjs/common';
import { DomainError } from '../../../common/errors/domain-error';

export class BagNotAtFactoryError extends DomainError {
  readonly code = 'WASH_BAG_NOT_AT_FACTORY';
  constructor(barcode: string) {
    super(`Bag is not at factory (TAKE_BACK): ${barcode}`, HttpStatus.BAD_REQUEST);
  }
}

export class ItemNotTaggableError extends DomainError {
  readonly code = 'WASH_ITEM_NOT_TAGGABLE';
  constructor(itemId: string) {
    super(`Item must be PICK_UP and IN_HOUSE to attach a tag: ${itemId}`, HttpStatus.CONFLICT);
  }
}

export class ItemNotAssignableError extends DomainError {
  readonly code = 'WASH_ITEM_NOT_ASSIGNABLE';
  constructor(itemId: string) {
    super(`Item must be TAGGED to assign a route: ${itemId}`, HttpStatus.CONFLICT);
  }
}

export class ItemNotScannable extends DomainError {
  readonly code = 'WASH_ITEM_NOT_SCANNABLE';
  constructor(itemId: string) {
    super(`Item must be SORTED or PROCESSING to scan a step: ${itemId}`, HttpStatus.CONFLICT);
  }
}

export class ItemAwaitingCustomerDecision extends DomainError {
  readonly code = 'WASH_ITEM_AWAITING_CUSTOMER_DECISION';
  constructor(itemId: string) {
    super(`Item is awaiting customer decision and cannot be scanned: ${itemId}`, HttpStatus.CONFLICT);
  }
}

export class ItemHasPendingRouteChange extends DomainError {
  readonly code = 'WASH_ITEM_HAS_PENDING_ROUTE_CHANGE';
  constructor(itemId: string) {
    super(`Item has a pending route change request and cannot be scanned: ${itemId}`, HttpStatus.CONFLICT);
  }
}

export class TagBarcodeConflictError extends DomainError {
  readonly code = 'WASH_TAG_BARCODE_CONFLICT';
  constructor(tagBarcode: string) {
    super(`Tag barcode is already in use: ${tagBarcode}`, HttpStatus.CONFLICT);
  }
}

export class WashItemNotFoundError extends DomainError {
  readonly code = 'WASH_ITEM_NOT_FOUND';
  constructor(itemId: string) {
    super(`Item not found: ${itemId}`, HttpStatus.NOT_FOUND);
  }
}

export class WashBagNotFoundError extends DomainError {
  readonly code = 'WASH_BAG_NOT_FOUND';
  constructor(barcode: string) {
    super(`Pickup bag not found: ${barcode}`, HttpStatus.NOT_FOUND);
  }
}

export class WashOrderNotFoundError extends DomainError {
  readonly code = 'WASH_ORDER_NOT_FOUND';
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`, HttpStatus.NOT_FOUND);
  }
}

export class TagNotFoundError extends DomainError {
  readonly code = 'WASH_TAG_NOT_FOUND';
  constructor(tagBarcode: string) {
    super(`No item is registered with tag: ${tagBarcode}`, HttpStatus.NOT_FOUND);
  }
}
