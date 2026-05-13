import { Prisma } from '@prisma/client';
import { BillingRequestView } from './billing.types';

export const BILLING_REPOSITORY = Symbol('BILLING_REPOSITORY');

/**
 * Idempotency key for SUPPLEMENT billing rows. Pair of (sourceType, sourceId)
 * is enforced UNIQUE by the DB; a second call with the same pair returns
 * the existing row instead of creating a duplicate.
 */
export type BillingSource =
  | { type: 'APPROVAL_REQUEST'; id: string }
  | { type: 'ROUTE_CHANGE_REQUEST'; id: string };

/**
 * Result of `claimAndFetchWaiting`.
 *
 * - `customerId`: human customerId of the order's owner. Null only if the
 *   order doesn't exist (defensive).
 * - `allWaiting`: every BillingRequest with status='WAITING' for the order,
 *   including ones that were already notified before this call. Returned
 *   so the caller can emit the FULL current state — the user-web client
 *   replaces (does not merge) by orderId on `billing:created`, so each
 *   push must carry the complete picture.
 * - `justClaimedCount`: how many rows this call freshly transitioned from
 *   notifiedAt=null to notifiedAt=NOW. The caller emits only when this is
 *   > 0 — otherwise the push would be redundant.
 */
export type ClaimAndFetchResult = {
  customerId: string | null;
  allWaiting: BillingRequestView[];
  justClaimedCount: number;
};

export interface BillingRepository {
  findById(id: string): Promise<BillingRequestView | null>;
  findPendingByCustomerId(customerId: string): Promise<BillingRequestView[]>;
  findBySource(source: BillingSource): Promise<BillingRequestView | null>;

  /**
   * Returns the human customerId of the order's owner, or null if the
   * order doesn't exist. Used for billing ownership checks.
   */
  findOrderCustomerId(orderId: string): Promise<string | null>;

  /**
   * Count of WAITING billing rows for the order. Used by delivery gate —
   * scan-outbound is allowed only when this is 0 (all BASE + SUPPLEMENT
   * resolved). Non-PAID/non-CANCELLED rows block outbound.
   */
  countWaitingByOrder(orderId: string): Promise<number>;

  /**
   * Idempotent at the DB level: if a BillingRequestItem already exists for
   * this orderItemId, returns the existing billing instead of throwing P2002.
   *
   * When `tx` is provided, all writes happen inside the caller's transaction
   * so that BASE billing creation can be atomically composed with the wash
   * use case's tag/status updates. Without `tx`, the method opens its own
   * implicit single-statement transaction (same behaviour as before).
   */
  createBillingRequest(
    input: {
      orderId: string;
      items: { orderItemId: string; amount: number }[];
    },
    tx?: Prisma.TransactionClient,
  ): Promise<BillingRequestView>;

  /**
   * Atomic compare-and-set: only transitions a WAITING row to PAID/CANCELLED.
   * Throws BillingAlreadyResolvedError if the row is no longer WAITING.
   */
  resolveRequest(id: string, status: 'PAID' | 'CANCELLED', actorId: string): Promise<BillingRequestView>;

  /**
   * Idempotent via UNIQUE(sourceType, sourceId). If a SUPPLEMENT row already
   * exists for this source, returns it without inserting a duplicate.
   * `notifiedAt` is always left as null — the customer is notified at the
   * next READY_TO_PACKAGE trigger (`claimAndFetchWaiting`), not here.
   */
  createSupplementBillingRequest(input: {
    orderId: string;
    totalAmount: number;
    source: BillingSource;
  }): Promise<BillingRequestView>;

  /**
   * Single-statement atomic claim, called when any item reaches
   * READY_TO_PACKAGE:
   *   1. Marks every WAITING billing in the order with notifiedAt=null
   *      as notified (NOW).
   *   2. Returns the order's complete WAITING set (BASE + SUPPLEMENT,
   *      newly-claimed + previously-notified).
   *   3. Returns how many rows were freshly claimed this call.
   *
   * Deadlock-free: the CTE acquires row locks in PG scan order; concurrent
   * RTPs on sibling items serialize via lock waits, then re-evaluate
   * WHERE and see 0 unnotified rows.
   *
   * BASE total is NOT updated here — it is frozen at tag-item time.
   * Route-change cost goes in SUPPLEMENT rows.
   */
  claimAndFetchWaiting(
    orderId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ClaimAndFetchResult>;
}
