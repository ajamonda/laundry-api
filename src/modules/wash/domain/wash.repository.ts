import { OrderItemStatus } from '@prisma/client';
import { ActorContext } from '../../processing-route/domain/processing-route.types';
import { BagView, OrderItemsView, PackageView, ProcessingQueueItem, WashItemView } from './wash.types';

export const WASH_REPOSITORY = Symbol('WASH_REPOSITORY');

export interface WashRepository {
  // Returns null if bag not found. Throws BagNotAtFactoryError if exists but not TAKE_BACK.
  findBagWithItems(barcode: string): Promise<BagView | null>;

  // Returns null if order not found.
  findOrderWithItems(orderId: string): Promise<OrderItemsView | null>;

  findItem(itemId: string): Promise<WashItemView | null>;
  findItemByTagBarcode(tagBarcode: string): Promise<WashItemView | null>;

  // Returns the PENDING route-change request id for the item, if any.
  findPendingRouteChange(orderItemId: string): Promise<{ id: string } | null>;

  // Validates tag uniqueness, sets tagBarcode + status=TAGGED, writes AuditLog — all in one tx.
  attachTagBarcode(input: {
    itemId: string;
    tagBarcode: string;
    actor: ActorContext;
  }): Promise<WashItemView>;

  // Simple status-only update (called after RouteEngine operations).
  setItemStatus(input: {
    itemId: string;
    status: OrderItemStatus;
  }): Promise<WashItemView>;

  // All items currently in processing (SORTED, PROCESSING, READY_TO_PACKAGE).
  findProcessingQueue(): Promise<ProcessingQueueItem[]>;

  // Groups every READY_TO_PACKAGE item by order into an ItemPackage and
  // flips them to READY_FOR_DELIVERY. Idempotent for empty input
  // (returns []).
  createPackages(): Promise<PackageView[]>;
}
