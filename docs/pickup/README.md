# Pickup

Pickup operators collect customer items into pickup bags and hand them off
to the factory.

## Bag State Machine (`PickupBagStatus`)

`READY → TAKE_OUT → CONTAIN → TAKE_BACK`

- `READY`: idle bag, no run attached.
- `TAKE_OUT`: bag is on a pickup run, on its way to customers.
- `CONTAIN`: items have been placed inside at the customer site.
- `TAKE_BACK`: bag has been handed off to the factory; wash domain takes over.

## Order / Item / Location Transitions Owned Here

| Action | Order | Item status | Item location |
|---|---|---|---|
| Customer-site pickup (items go into bag) | `REQUEST → PICK_UP` | `INIT → PICK_UP` | `CUSTOMER_PICK_UP → PICK_UP_TRUCK` |
| Factory handoff | `PICK_UP → PROCESSING` | — | `PICK_UP_TRUCK → IN_HOUSE` |

## API (StaffAuthGuard, `PICKUP` role)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/pickup/requests` | Today's pickup queue. |
| `GET` | `/pickup/requests/:orderId` | One order + items. |
| `POST` | `/pickup/runs` | Register a pickup run (vehicle + staff). |
| `POST` | `/pickup/runs/:runId/bags` | Attach a bag barcode to the active run → bag `TAKE_OUT`. |
| `POST` | `/pickup/requests/:orderId/photos` | Record customer-site pickup photo URL. |
| `POST` | `/pickup/bags/:bagBarcode/items` | Put items into the bag → bag `CONTAIN`, items `PICK_UP`, location `PICK_UP_TRUCK`. |
| `POST` | `/pickup/bags/:bagBarcode/handoff` | Hand bag off to factory → bag `TAKE_BACK`, order `PROCESSING`, location `IN_HOUSE`. |

## Tables

`pickup_vehicles`, `pickup_runs`, `pickup_bags`, `pickup_bag_items`,
`pickup_photos`.
