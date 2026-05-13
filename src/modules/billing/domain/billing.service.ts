import { Inject, Injectable } from '@nestjs/common';
import { BillingGateway } from '../interfaces/ws/billing.gateway';
import { BILLING_REPOSITORY, BillingRepository } from './billing.repository';
import { BillingRequestView } from './billing.types';

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
   */
  async onItemTagged(orderItemId: string, orderId: string, estimatedMinAmount: number): Promise<void> {
    await this.repo.createBillingRequest({
      orderId,
      items: [{ orderItemId, amount: estimatedMinAmount }],
    });
  }

  /**
   * Atomic claim + push. Only emits when at least one previously-unnotified
   * row was claimed this call — keeps repeat triggers (sibling items
   * reaching READY_TO_PACKAGE without any new SUPPLEMENT) silent.
   */
  async onItemReadyToPackage(orderId: string): Promise<void> {
    const { customerId, allWaiting, justClaimedCount } =
      await this.repo.claimAndFetchWaiting(orderId);
    if (!customerId) return;
    if (justClaimedCount === 0) return;
    if (allWaiting.length === 0) return;
    this.gateway.notifyCustomer(customerId, 'billing:created', allWaiting);
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
