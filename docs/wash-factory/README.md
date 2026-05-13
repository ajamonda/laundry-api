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
| wash → processing-route | `RouteEngineService.createPlan` | `assign-route` |
| wash → processing-route | `RouteEngineService.completeCurrentStep` | `scan-step` |
| wash → billing | `BillingService.onItemTagged` | `tag-item` |
| wash → billing | `BillingService.onItemReadyToPackage(orderId)` | `scan-step` plan completion |
| wash → processing-route | `AuditLogger.logInTransaction` (inside `attachTagBarcode`) | atomic tag audit |
| exception → wash (read) | `wash.findPendingRouteChange` via repository | `scan-step` blocker |

## Atomicity caveat

`tag-item`, `assign-route`, `scan-step` each split work across two transactions (route-engine / billing inside their own tx, then item status update). Failure between them leaves the item with inconsistent status. **Accepted MVP risk.** Do not assume cross-step atomicity.

## Invariants

- `tagBarcode` is unique across all `order_items`. P2002 on duplicate.
- After `tag-item`, BASE billing for the item exists exactly once (idempotent — see [billing](../billing/README.md#raceidempotency-guarantees)).
- `scan-step` advances the plan by exactly one step per call (plus the auto-skip of any literal `READY_TO_PACKAGE` step inside the same call).
- Plan completion via `scan-step` triggers `onItemReadyToPackage`. Plan completion via approval respond does **not** trigger it. (Approval-driven completion currently sets `status=READY_FOR_DELIVERY` directly, bypassing READY_TO_PACKAGE — known edge case, document if hit.)

## When you change this domain

- New item state in the wash path → update `OrderItemStatus` enum + the status-flow diagram above + the precondition table.
- New cross-domain call → add to the wiring table; if it's billing, update [billing/README.md](../billing/README.md) trigger flow.
- Adding a new scan-step blocker → also update [exception-flow/README.md](../exception-flow/README.md) "Scan-step blockers" table.
