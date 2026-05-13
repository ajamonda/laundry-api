# Pickup

`src/modules/pickup/` — collects customer items, hands off to factory.

## Tables
- `pickup_vehicles` (seeded)
- `pickup_bags` (seeded — barcodes `PICKUP-BAG-001..NNN`)
- `pickup_runs`, `pickup_bag_items`, `pickup_photos`

## Bag state machine (`PickupBagStatus`)

| Status | Reached by |
|---|---|
| `READY` | initial state / after `take-back` returns |
| `TAKE_OUT` | `POST /pickup/runs/:runId/bags` (bag attached to run) |
| `CONTAIN` | `POST /pickup/bags/:bagBarcode/items` (items placed) |
| `TAKE_BACK` | `POST /pickup/bags/:bagBarcode/handoff` (delivered to factory) |

## Order / item / location transitions owned here

| Action | Order status | Item status | Item location |
|---|---|---|---|
| Items into bag | `REQUEST → PICK_UP` | `INIT → PICK_UP` | `CUSTOMER_PICK_UP → PICK_UP_TRUCK` |
| Factory handoff | `PICK_UP → PROCESSING` | (unchanged) | `PICK_UP_TRUCK → IN_HOUSE` |

## Endpoints (StaffAuthGuard, `PICKUP`)

| Method | Path | Body / Notes |
|---|---|---|
| `GET` | `/pickup/requests` | Today's pickup queue |
| `GET` | `/pickup/requests/:orderId` | Order detail + items |
| `POST` | `/pickup/runs` | `{ vehicleCode }` → `{ runId }` |
| `POST` | `/pickup/runs/:runId/bags` | `{ bagBarcode }` → bag `TAKE_OUT` |
| `POST` | `/pickup/requests/:orderId/photos` | `{ runId, photoUrl }` |
| `POST` | `/pickup/bags/:bagBarcode/items` | `{ runId, orderId, itemIds }` → bag `CONTAIN`, items `PICK_UP`, location `PICK_UP_TRUCK` |
| `POST` | `/pickup/bags/:bagBarcode/handoff` | `{ runId }` → bag `TAKE_BACK`, order `PROCESSING`, location `IN_HOUSE` |

## Preconditions enforced by repository

- `pickup/bags/:bag/items`: pickup photo for the order must already exist (`pickupPhoto.count > 0`). Returns 400 otherwise.
- `pickup/bags/:bag/items`: bag must be `TAKE_OUT` and tied to the given `runId`. 409 otherwise.
- `pickup/runs/:run/bags`: bag must be `READY` and `active = true`. 409/400 otherwise.

## Invariants

- A bag attaches to at most one active run at a time (`current_run_id`).
- `resetDb()` ([test/utils/db.ts](../../test/utils/db.ts)) clears `pickup_bags.current_run_id` before truncating `pickup_runs` — otherwise the FK blocks DELETE. Keep this UPDATE step if you add new FK references.

## When you change this domain

- Adding a new bag state → update `PickupBagStatus` enum, migration, the table above, and every guard that filters by status (`registerBag`, `putItemsIntoBag`, `handoffBag`).
- Adding a new pickup action that touches `OrderItem` → audit log entry in the same tx via `AuditLogger.logInTransaction`.
