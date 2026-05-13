import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BillingGateway } from '../interfaces/ws/billing.gateway';
import { BILLING_REPOSITORY, BillingRepository } from './billing.repository';
import { BillingRequestView } from './billing.types';

/**
 * Payload describing a pending customer push that the wash use case will
 * emit AFTER its enclosing transaction commits. Returned by
 * `claimWaitingForReadyToPackage` so that WebSocket side-effects never run
 * inside a transaction that might still roll back.
 *
 * `null` means "nothing to push" (no customer / no fresh claim / empty set).
 */
export type ReadyToPackageEmitPayload = {
  customerId: string;
  allWaiting: BillingRequestView[];
} | null;

/**
 * Push policy (per laundry-api spec):
 *
 *   - BASE rows are created at tag-item time with `notifiedAt = null`.
 *   - SUPPLEMENT rows (from approval / route-change) are created with
 *     `notifiedAt = null`.
 *   - The customer's `/billing` socket is pushed only when ANY item of an
 *     order reaches READY_TO_PACKAGE — `onItemReadyToPackage` runs the
 *     atomic claim-and-fetch and emits one batched payload containing the
 *     order's complete WAITING set.
 *   - Subsequent READY_TO_PACKAGE triggers in the same order suppress the
 *     emit if nothing new was claimed (no fresh BASE or SUPPLEMENT since
 *     last trigger).
 */
@Injectable()
export class BillingService {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly repo: BillingRepository,
    private readonly gateway: BillingGateway,
  ) {}

  /**
   * Creates the BASE billing row for the item. Idempotent — repository
   * swallows P2002 from a duplicate `order_item_id` and returns the
   * existing row. Does NOT notify; the customer hears about this when an
   * item of the order reaches READY_TO_PACKAGE.
   *
   * Optional `tx` lets the wash tag-item use case run this write inside its
   * single transaction so that tag + BASE billing + status flip succeed or
   * fail atomically.
   */
  async onItemTagged(
    orderItemId: string,
    orderId: string,
    estimatedMinAmount: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.repo.createBillingRequest(
      {
        orderId,
        items: [{ orderItemId, amount: estimatedMinAmount }],
      },
      tx,
    );
  }

  /**
   * Transaction-safe half of the previous `onItemReadyToPackage`. Runs the
   * atomic claim + fetch inside the caller's transaction (or its own, if
   * `tx` is not supplied) and RETURNS the payload to emit. The actual
   * WebSocket push MUST be done by the caller AFTER the transaction
   * commits, via `emitReadyToPackage` — otherwise a rolled-back tx would
   * still notify the customer of a billing state that no longer exists.
   *
   * Returns `null` when:
   *   - order is missing (defensive),
   *   - no row was freshly claimed this call (suppress redundant push),
   *   - the WAITING set is empty.
   */
  async claimWaitingForReadyToPackage(
    orderId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ReadyToPackageEmitPayload> {
    const { customerId, allWaiting, justClaimedCount } =
      await this.repo.claimAndFetchWaiting(orderId, tx);
    if (!customerId) return null;
    if (justClaimedCount === 0) return null;
    if (allWaiting.length === 0) return null;
    return { customerId, allWaiting };
  }

  /**
   * Side-effect-only step. Call this AFTER the enclosing transaction has
   * committed. Safe to call with `null` (no-op).
   */
  emitReadyToPackage(payload: ReadyToPackageEmitPayload): void {
    if (!payload) return;
    this.gateway.notifyCustomer(payload.customerId, 'billing:created', payload.allWaiting);
  }

  /**
   * SUPPLEMENT billing from an approval response. `approvalRequestId` is
   * the idempotency key — double-fired approvals reuse the same DB row.
   * No socket push at this point; the row is picked up at the next
   * READY_TO_PACKAGE trigger for any item of the order.
   */
  async createSupplementBillingForApproval(input: {
    approvalRequestId: string;
    orderId: string;
    totalAmount: number;
  }): Promise<BillingRequestView> {
    return this.repo.createSupplementBillingRequest({
      orderId: input.orderId,
      totalAmount: input.totalAmount,
      source: { type: 'APPROVAL_REQUEST', id: input.approvalRequestId },
    });
  }

  /**
   * SUPPLEMENT billing from a route-change approval. `routeChangeRequestId`
   * is the idempotency key. No socket push at this point.
   */
  async createSupplementBillingForRouteChange(input: {
    routeChangeRequestId: string;
    orderId: string;
    totalAmount: number;
  }): Promise<BillingRequestView> {
    return this.repo.createSupplementBillingRequest({
      orderId: input.orderId,
      totalAmount: input.totalAmount,
      source: { type: 'ROUTE_CHANGE_REQUEST', id: input.routeChangeRequestId },
    });
  }
}
