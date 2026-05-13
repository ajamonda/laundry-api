# Billing

`src/modules/billing/`

## Tables
- `billing_requests` — BASE + SUPPLEMENT rows
- `billing_request_items` — line items (BASE only)
- `payment_events` — billing-side timeline (`BILLING_CREATED`, `PAYMENT_SUCCEED`, `PAYMENT_FAILED`)

## Exports
| Symbol | Used by |
|---|---|
| `BillingService` | `wash` (`onItemTagged`, `onItemReadyToPackage`), `exception` (`createSupplementBillingForApproval`, `createSupplementBillingForRouteChange`) |

## Two row types

| Type | Created at | `totalAmount` | `notifiedAt` at creation | `sourceType` / `sourceId` |
|---|---|---|---|---|
| BASE | `tag-item` | snapshot of `orderItem.estimatedMinAmount` at tag time — **frozen, never updated by server** | null | both null |
| SUPPLEMENT | approval `APPROVE_*` with `extraAmount`, or route-change approve with `additionalCost` | the extra amount (signed — negative allowed for refunds) | null | `'APPROVAL_REQUEST' \| 'ROUTE_CHANGE_REQUEST'` + the request's id |

## Push trigger — every case

| # | Scenario | Push? | Payload |
|---|---|---|---|
| 1 | Single-item order, item reaches RTP | ✅ | `[BASE_item1]` |
| 2 | Multi-item order, **first** RTP arrival | ✅ | `[BASE_item1, ..., BASE_itemN]` (every BASE created at tag time → all claimed at once) |
| 3 | Multi-item order, subsequent RTP arrival without new SUPPLEMENT in between | ❌ | (zero rows claimed → emit suppressed) |
| 4 | Any RTP arrival with a SUPPLEMENT created since last push | ✅ | Order's complete WAITING set (the client replaces by orderId — payload must carry the full picture) |

**Never pushes**: order creation, tag-item, approval response, route-change approval, pay/cancel, regular scan-step that doesn't reach RTP, socket reconnect (REST `GET /billing/requests` handles that).

## Code flow

```
POST /wash/items/:id/tag                      (once per item)
  └─ TagItemUseCase
       └─ BillingService.onItemTagged
            └─ repo.createBillingRequest
                 ├─ INSERT billing_request(type=BASE, totalAmount=estimatedMinAmount, notifiedAt=null)
                 ├─ INSERT billing_request_items
                 └─ catch P2002 on duplicate orderItemId → return existing row (idempotent)

POST /wash/approval-requests/:id/respond  (decision=APPROVE_*, extraAmount > 0)
  └─ RespondApprovalUseCase
       ├─ CAS approval status WAITING → RESOLVED (throws on count===0)
       └─ BillingService.createSupplementBillingForApproval(approvalRequestId, ...)
            └─ repo.createSupplementBillingRequest
                 ├─ INSERT billing_request(type=SUPPLEMENT, notifiedAt=null,
                 │                         sourceType='APPROVAL_REQUEST', sourceId=approvalId)
                 └─ catch P2002 on UNIQUE(sourceType, sourceId) → return existing row

POST /wash/route-change-requests/:id/approve  (additionalCost ≠ 0)
  └─ ApproveRouteChangeUseCase
       ├─ CAS routeChange status PENDING → APPROVED (throws on count===0)
       ├─ RouteEngineService.switchRoute
       ├─ orderItemOption swap (cleaning_method to match new route)
       ├─ BillingService.createSupplementBillingForRouteChange(routeChangeRequestId, ...)
       │    └─ repo.createSupplementBillingRequest (same idempotency as above)
       └─ orderItem.estimatedMinAmount += additionalCost
          (running total for wash-web's RouteChangeForm — NOT a BASE-billed amount)

POST /wash/tags/:tag/scan-step  (when plan completes → status=READY_TO_PACKAGE)
  └─ ScanStepUseCase
       └─ BillingService.onItemReadyToPackage(orderId)
            └─ repo.claimAndFetchWaiting(orderId)   [single transaction]
                 ├─ UPDATE billing_requests
                 │     SET notifiedAt = NOW
                 │     WHERE orderId = $ AND status = 'WAITING' AND notifiedAt IS NULL
                 │   → justClaimedCount
                 └─ SELECT * FROM billing_requests
                       WHERE orderId = $ AND status = 'WAITING'
                   → allWaiting (newly + previously claimed)
            └─ if justClaimedCount > 0 && allWaiting.length > 0:
                  gateway.notifyCustomer(customerId, 'billing:created', allWaiting)
```

## Race / idempotency guarantees

| Risk | Protection | Where |
|---|---|---|
| Pay/Cancel double-fire | `updateMany WHERE id AND status='WAITING'` + `count===0` throws | `resolveRequest` |
| Tag-item double-fire → duplicate BASE | `billing_request_items.order_item_id` UNIQUE + P2002 catch → existing | `createBillingRequest` |
| Approval / route-change double-fire → duplicate SUPPLEMENT | (a) CAS on request status, (b) `UNIQUE(sourceType, sourceId)` + P2002 catch | `RespondApprovalUseCase` + `createSupplementBillingRequest` |
| Concurrent RTP for sibling items → deadlock | Single-statement `updateMany` locks rows in PG scan order; second tx waits then sees 0 unnotified | `claimAndFetchWaiting` |
| Redundant emit on subsequent RTP | Suppress when `justClaimedCount === 0` | `onItemReadyToPackage` |
| At-most-once notify (emit failure after commit) | Customer reconnect → `GET /billing/requests` (`notifiedAt != null`) replays. MVP-accepted — no outbox |

Transaction isolation is PG default (`READ COMMITTED`). All guarantees use row locks / CAS / UNIQUE — do not elevate isolation.

## Endpoints (CustomerAuthGuard)

| Method | Path | Use case | Notes |
|---|---|---|---|
| `GET` | `/billing/requests` | `GetCustomerBillingRequestsUseCase` | WAITING rows where `notifiedAt != null` — reconnect recovery. Pre-push rows are deliberately hidden |
| `GET` | `/billing/requests/:id` | `GetBillingRequestUseCase` | Single row |
| `POST` | `/billing/requests/:id/pay` | `PayBillingRequestUseCase` | CAS WAITING → PAID |
| `POST` | `/billing/requests/:id/cancel` | `CancelBillingRequestUseCase` | CAS WAITING → CANCELLED |

Ownership check: `billingRequest.order.customer.customerId === requestingCustomerId`. **Never** compare against `order.customer_id` (UUID PK — confirmed foot-gun).

## WebSocket — `/billing`

| Event | Payload | When |
|---|---|---|
| `billing:created` | `BillingRequest[]` (order's complete WAITING set) | RTP trigger AND at least one row was freshly notified by this call |

Client groups by `orderId` and sums `totalAmount` (`laundry-user-web/src/useRealtimeRequests.ts:upsertBillingMessages`). Server sends rows; client computes the displayed sum.

## Delivery gate

`scan-outbound` (delivery domain) requires `delivery.countWaitingBillings(orderId) === 0`. BASE and SUPPLEMENT both block. See [delivery/README.md](../delivery/README.md#billing-gate-scan-outbound).

## Schema (excerpt)

```prisma
model BillingRequest {
  id          String    @id @default(uuid())
  orderId     String    @map("order_id")
  type        String    @default("BASE")    // BASE | SUPPLEMENT
  sourceType  String?   @map("source_type") // SUPPLEMENT idempotency key
  sourceId    String?   @map("source_id")
  status      String    @default("WAITING") // WAITING | PAID | CANCELLED
  totalAmount Int       @map("total_amount") // signed; negative SUPPLEMENT allowed
  createdAt   DateTime  @default(now())
  resolvedAt  DateTime?
  notifiedAt  DateTime?

  @@index([orderId, type])
  @@unique([sourceType, sourceId])  // PG NULLs are distinct → only constrains SUPPLEMENT rows
}
```

## Invariants

- BASE `totalAmount` is set once at creation and never updated.
- SUPPLEMENT `notifiedAt` is null until the next RTP claim of the order.
- `(sourceType, sourceId)` is non-null on every SUPPLEMENT and uniquely identifies its origin domain object.
- `payment_events` rows accumulate (`BILLING_CREATED` + resolution event). Tests filtering for "exactly one resolution" must constrain `eventType: { in: ['PAYMENT_SUCCEED', 'PAYMENT_FAILED'] }`.

## Anti-patterns (do not)

- **Do not push on SUPPLEMENT creation.** The spec is batched-with-BASE at next RTP. Past mistake: I added `createAndNotifySupplement` immediate-emit during a race-fix refactor and shipped it as "the design"; the original comment in `approve-route-change.use-case.ts` said otherwise. Reverted.
- **Do not overwrite BASE `totalAmount` with `orderItem.estimatedMinAmount` at RTP time.** That field accumulates `additionalCost` from route changes; using it as fallback double-counts (charged once in updated BASE, once in SUPPLEMENT).
- **Do not introduce `createSupplementBilling` without a `source` argument.** Idempotency is enforced by `UNIQUE(sourceType, sourceId)` + P2002 catch — supplying both columns is mandatory at the service-API level.

## When you change this domain

- New SUPPLEMENT source (e.g. `MANUAL_ADJUSTMENT`) → extend `BillingSource` union, add a new `createSupplementBillingFor*` method on `BillingService`, document the source value in the two-row-types table.
- New push trigger (currently only RTP) → update the push-trigger table; verify client `useRealtimeRequests.ts` can still upsert correctly (it replaces by `billing:order:${orderId}` — payload must remain the full WAITING set).
- New billing status (currently `WAITING | PAID | CANCELLED`) → update CAS conditions in `resolveRequest` and the delivery gate.
- Schema change on `billing_requests` → migration + update [test/utils/db.ts](../../test/utils/db.ts) is not needed (table is already volatile).
