# Wash / Factory Operations

The wash domain owns item transitions from `PICK_UP` (factory handoff) to
`READY_FOR_DELIVERY` (packed for outbound).

## Status Flow

```
PICK_UP ──tag-item──► TAGGED ── (auto if plan exists) ──► SORTED ──scan-step──► PROCESSING ──(plan completes)──► READY_TO_PACKAGE ──POST /wash/packages──► READY_FOR_DELIVERY
                              └─ (no plan) ──► assign-route ──►
```

After tagging, all operator actions key off the **tag barcode** —
`OrderItem.tagBarcode` is unique across the factory, so the operator never
needs to know the item ID.

### Tag → Sorted

Most items already have a processing plan (auto-created at order creation
when the catalog can resolve a route — see
[catalog](../catalog-pricing/README.md#catalog--processing-route-link)).
In that case `tag-item` flips the status straight to `SORTED` after writing
the tag barcode.

If no plan exists (catalog couldn't resolve a route for the item +
options), `tag-item` leaves status at `TAGGED` and the wash operator must
call `/wash/tags/:tagBarcode/assign-route` with a `routeCode` to create
the plan manually.

### Scan-Step

`scan-step` completes the current step via
`RouteEngineService.completeCurrentStep`. The literal `READY_TO_PACKAGE`
step at the end of every non-`SECOND_HAND_PROCESSING` route is
auto-completed inside the same scan — operators never scan it.

| Action | Precondition | Status change |
|---|---|---|
| `tag-item` | `status=PICK_UP`, `location=IN_HOUSE` | `PICK_UP → TAGGED` (atomic audit). Also triggers `BillingService.onItemTagged` (creates BASE billing row for this item). If a plan exists, status is then flipped `TAGGED → SORTED`. |
| `assign-route` (fallback) | `status=TAGGED` | `TAGGED → SORTED` + `RouteEngineService.createPlan` |
| `scan-step` | `status=SORTED` or `PROCESSING` | `SORTED → PROCESSING`, or → `READY_TO_PACKAGE` when the plan completes. On READY_TO_PACKAGE, triggers `BillingService.onItemReadyToPackage` (updates billing total to final amount + pushes socket notify once). |
| `POST /wash/packages` | items in `READY_TO_PACKAGE` (per order) | → `READY_FOR_DELIVERY` after grouping into `ItemPackage` |

`scan-step` is blocked with `409` when:
- the current step is `WAIT_CUSTOMER_DECISION` (`ItemAwaitingCustomerDecision`)
- there is a PENDING `RouteChangeRequest` on the item (`ItemHasPendingRouteChange`)

### Atomicity Caveat

`tag-item`, `assign-route`, and `scan-step` each split work across the
route-engine tx and an item-status update. Failure between the two leaves
the item with an inconsistent status. Accepted MVP risk; resolving requires
an external-tx variant of RouteEngineService methods.

## API (StaffAuthGuard, `WASH` role)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/wash/processing-queue` | Wash queue overview. |
| `GET` | `/wash/bags/:barcode` | Returns bag + contained items; rejects bags not in `TAKE_BACK`. |
| `GET` | `/wash/orders/:orderId/items` | Items by order (in-factory view). |
| `GET` | `/wash/tags/:tagBarcode` | Look up an item by its tag barcode. |
| `POST` | `/wash/items/:id/tag` | Attach tag barcode; rejects duplicates and non-`PICK_UP` items. Auto-advances to `SORTED` when a plan exists. |
| `POST` | `/wash/tags/:tagBarcode/assign-route` | **Fallback** for items without an auto-created plan. Calls `createPlan`, sets status `SORTED`. |
| `POST` | `/wash/tags/:tagBarcode/scan-step` | Calls `completeCurrentStep`. |
| `POST` | `/wash/packages` | Group `READY_TO_PACKAGE` items by order → `ItemPackage` → status `READY_FOR_DELIVERY`. |

Exception / route-change endpoints (`/wash/items/:id/raise-issue`,
`/wash/items/:id/activate-exception-flow`, `/wash/items/:id/request-route-change`,
…) are owned by the exception domain — see
[exception-flow](../exception-flow/README.md).

## Module

`WashModule` imports `ProcessingRouteModule` (for `RouteEngineService` +
`AuditLogger`) and `BillingModule` (for `BillingService`).
