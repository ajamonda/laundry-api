# Delivery

`src/modules/delivery/` — package-based outbound + customer handoff.

## Tables
- `delivery_vehicles` (seeded: `DELIVERY_VAN_01/02/03`)
- `delivery_runs`, `delivery_run_items`
- `delivery_handoff_photos` (one per package, `package_id` UNIQUE)

## Unit of work

**Package**, not item. `ItemPackage` is created by `POST /wash/packages` (see [wash-factory](../wash-factory/README.md)). All items in a package move together.

## Flow

```
READY_FOR_DELIVERY (packaged)
  ├─ scan-outbound (packageId)  → all items DELIVERING; location IN_HOUSE → DELIVERING_TRUCK
  └─ handoff (packageId)        → all items FINISHED; location DELIVERING_TRUCK → CUSTOMER_DEST
```

After `handoff`, the order's aggregate status is recomputed:
- All items `FINISHED` → `order.status = FINISHED`
- Some items `FINISHED` → `order.status = PARTIAL_FINISHED`

## Endpoints (StaffAuthGuard, `DELIVERY`)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/delivery/vehicles` | Active vehicle list |
| `GET` | `/delivery/work` | Packages whose items are READY_FOR_DELIVERY |
| `GET` | `/delivery/runs/me/active` | This staff's active run |
| `GET` | `/delivery/runs/me/loaded-packages` | Packages already loaded on this run |
| `GET` | `/delivery/packages/:packageId` | Package detail |
| `POST` | `/delivery/runs` | `{ vehicleCode }` |
| `POST` | `/delivery/packages/:packageId/scan-outbound` | Gated by billing — see below |
| `POST` | `/delivery/packages/:packageId/handoff` | All package items must be DELIVERING |
| `POST` | `/delivery/packages/:packageId/handoff-photo` | `{ url }` — upserts the single handoff photo |
| `POST` | `/delivery/runs/:runId/close` | Closes the active run |

## Billing gate (scan-outbound)

`scan-outbound` calls `delivery.countWaitingBillings(orderId)`:
- `> 0` → throws `BillingNotPaidError` (409). Both BASE and SUPPLEMENT count. Either unpaid blocks outbound.
- `== 0` → proceeds.

Implementation: `delivery.repository.countWaitingBillings` queries `billing_requests.count WHERE orderId AND status='WAITING'`. No type filter — every kind blocks. See [billing/README.md](../billing/README.md#delivery-gate-integration).

## Other gates

| Action | Precondition |
|---|---|
| `scan-outbound` | All items in package `READY_FOR_DELIVERY` |
| `scan-outbound` | An ACTIVE delivery run exists for this staff |
| `handoff` | All items in package `DELIVERING` |

## Audit keywords

Emitted via `AuditLogger.logInTransaction` (passed `tx`):
- `ITEM_SCAN_OUTBOUND` (one row per item on outbound scan)
- `ITEM_HANDED_OFF` (one row per item on handoff)

## Invariants

- `delivery_run_items.order_item_id` is UNIQUE — an item is loaded on at most one run.
- `delivery_handoff_photos.package_id` is UNIQUE — at most one photo per package; re-POST updates URL.
- Order status recompute only fires inside the handoff transaction. Don't recompute order status from other paths.

## When you change this domain

- New gate condition for outbound → update the "Other gates" table; add a test in `test/e2e/`.
- New billing type that should also block outbound → no code change here (the gate counts every WAITING row regardless of type). Update [billing/README.md](../billing/README.md) instead.
- New audit keyword → add to the list above.
