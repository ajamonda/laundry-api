# Wash / Factory

`src/modules/wash/` — owns item transitions from `PICK_UP` (factory handoff) through to `READY_FOR_DELIVERY` (packed).

## Status flow

```
PICK_UP ──tag-item──► TAGGED ──(plan exists?)──► SORTED ──scan-step──► PROCESSING ──(plan completes)──► READY_TO_PACKAGE ──POST /wash/packages──► READY_FOR_DELIVERY
                              └──(no plan)──► assign-route ──►
```

`tagBarcode` is unique across the factory — all wash actions after tagging key off the tag, not the item ID.

## Action preconditions + effects

| Action | Status precondition | Effect | Cross-domain |
|---|---|---|---|
| `tag-item` | `PICK_UP`, location `IN_HOUSE` | Set `tagBarcode`, `status=TAGGED`, audit `ITEM_TAGGED`. **Trigger `BillingService.onItemTagged`** (BASE billing). If plan exists (auto-created by catalog), set `status=SORTED`. | `BillingService.onItemTagged` |
| `assign-route` (fallback) | `TAGGED` | `RouteEngineService.createPlan` + `status=SORTED` | `RouteEngineService` |
| `scan-step` | `SORTED` or `PROCESSING`; not WAIT_CUSTOMER_DECISION; no PENDING route-change | `RouteEngineService.completeCurrentStep`. `SORTED → PROCESSING` on first scan. On `isPlanCompleted`, `status=READY_TO_PACKAGE` + **trigger `BillingService.onItemReadyToPackage`**. `READY_TO_PACKAGE` step (the literal) auto-completes inside the same scan. | `RouteEngineService`, `BillingService.onItemReadyToPackage` |
| `POST /wash/packages` | items in `READY_TO_PACKAGE` (per order) | Groups items into `ItemPackage` rows; `status=READY_FOR_DELIVERY` | — |

## Endpoints (StaffAuthGuard, `WASH`)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/wash/processing-queue` | All items in SORTED/PROCESSING/READY_TO_PACKAGE |
| `GET` | `/wash/bags/:barcode` | Bag + items. Rejects if bag not `TAKE_BACK` |
| `GET` | `/wash/orders/:orderId/items` | In-factory order view |
| `GET` | `/wash/tags/:tagBarcode` | Item by tag |
| `POST` | `/wash/items/:id/tag` | `{ tagBarcode }`. P2002 on duplicate tag returns 409 |
| `POST` | `/wash/tags/:tag/assign-route` | `{ routeCode }`. Fallback — only used when catalog's `resolveRouteCode` returned null at order time |
| `POST` | `/wash/tags/:tag/scan-step` | No body. May 409 (`ItemAwaitingCustomerDecision` / `ItemHasPendingRouteChange`) |
| `POST` | `/wash/packages` | No body. Returns `{ packages: PackageView[] }` |

Exception / route-change endpoints (`/wash/items/:id/raise-issue`, `/activate-exception-flow`, `/request-route-change`, `/approval-requests/...`, `/route-change-requests/...`) live in [exception-flow](../exception-flow/README.md).

## Cross-domain wiring

| Direction | API | Used for |
|---|---|---|
| wash → processing-route | `RouteEngineService.createPlan(input, tx?)` | `assign-route` |
| wash → processing-route | `RouteEngineService.completeCurrentStep(input, tx?)` | `scan-step` |
| wash → billing | `BillingService.onItemTagged(..., tx?)` | `tag-item` |
| wash → billing | `BillingService.claimWaitingForReadyToPackage(orderId, tx?)` → `emitReadyToPackage(payload)` | `scan-step` plan completion (claim in-tx, push post-commit) |
| wash → processing-route | `AuditLogger.logInTransaction` (inside `attachTagBarcode`) | atomic tag audit |
| exception → wash (read) | `wash.findPendingRouteChange` via repository | `scan-step` blocker |

## Transaction model (HARD RULES — do not regress)

The three multi-step wash use cases (`tag-item`, `assign-route`, `scan-step`) each run **all DB writes inside a single `prisma.$transaction` opened by the use case**. Sub-operations accept an optional `tx: Prisma.TransactionClient` and MUST use it when supplied.

| Use case | Writes that share one tx |
|---|---|
| `tag-item` | `attachTagBarcode` (tagBarcode + status=TAGGED + ITEM_TAGGED audit) → `billing.onItemTagged` (BASE billing) → `setItemStatus('SORTED')` if plan exists |
| `assign-route` | `routeEngine.createPlan` (plan + initial step + PLAN_CREATED audit) → `setItemStatus('SORTED')` |
| `scan-step` | `routeEngine.completeCurrentStep` (×1 or ×2 for auto-skip) → `setItemStatus(...)` → `billing.claimWaitingForReadyToPackage` |

Rules when editing these use cases or their sub-operations:

1. **Never** open a new `prisma.$transaction` inside a sub-operation when the caller has supplied `tx`. Pattern: `const work = (client) => ...; return tx ? work(tx) : this.prisma.$transaction(work);`.
2. **Never** add a sub-operation that does DB writes for these flows without threading `tx` through. A wash use case's writes must all be in one tx.
3. **Never** call `gateway.notifyCustomer` (or any other external side-effect: HTTP, WS, queue publish, log shipping) **inside** a `prisma.$transaction` callback. Return a payload from inside the tx, fire the side-effect after `$transaction` resolves. See `scan-step.use-case.ts` for the canonical pattern with `claimWaitingForReadyToPackage` + `emitReadyToPackage`.
4. **Read-then-throw guards** that don't write (existence checks, status precondition checks, `findPendingRouteChange`) MAY run before the `$transaction` block. They MUST NOT depend on tx state that the same use case will create.
5. `buildItemView` in `PrismaWashRepository` reads `itemProcessingState` via `this.prisma` (not the tx client). This is intentional — the read is post-write for a return value and tolerates eventual visibility. Do not "fix" it by threading tx unless you also re-verify all callers.
6. Repository methods with `tx?` parameter follow this contract: when `tx` is omitted, behaviour is identical to the pre-refactor version (own transaction, same semantics). Do not change return shape based on whether tx is supplied.

## Invariants

- `tagBarcode` is unique across all `order_items`. P2002 on duplicate.
- After `tag-item`, BASE billing for the item exists exactly once (idempotent — see [billing](../billing/README.md#raceidempotency-guarantees)).
- `scan-step` advances the plan by exactly one step per call (plus the auto-skip of any literal `READY_TO_PACKAGE` step inside the same call).
- Plan completion via `scan-step` triggers `onItemReadyToPackage`. Plan completion via approval respond does **not** trigger it. (Approval-driven completion currently sets `status=READY_FOR_DELIVERY` directly, bypassing READY_TO_PACKAGE — known edge case, document if hit.)

## When you change this domain

- New item state in the wash path → update `OrderItemStatus` enum + the status-flow diagram above + the precondition table.
- New cross-domain call → add to the wiring table; if it's billing, update [billing/README.md](../billing/README.md) trigger flow.
- Adding a new scan-step blocker → also update [exception-flow/README.md](../exception-flow/README.md) "Scan-step blockers" table.
