# Delivery

Delivery is **package-based**: the unit of scanning, handoff, and photo
attachment is an `ItemPackage` (created by `POST /wash/packages`), not an
individual item.

## Flow

```
READY_FOR_DELIVERY (packaged)
  ├─ POST /delivery/packages/:packageId/scan-outbound
  │    ├─ requires BASE billing.status === 'PAID'   → else 409 BillingNotPaidError
  │    ├─ requires an ACTIVE delivery run            → else 404
  │    └─ all items in package: READY_FOR_DELIVERY → DELIVERING
  │       (location IN_HOUSE → DELIVERING_TRUCK)
  └─ POST /delivery/packages/:packageId/handoff
       ├─ all items in package must be DELIVERING
       └─ → FINISHED (location DELIVERING_TRUCK → CUSTOMER_DEST)
```

When items reach `FINISHED`, the order aggregate recomputes:
- all items `FINISHED` → `order.status = FINISHED`
- some items `FINISHED` → `order.status = PARTIAL_FINISHED`

## API (StaffAuthGuard, `DELIVERY` role)

| Method | Path | Notes |
|---|---|---|
| `GET` | `/delivery/vehicles` | Active delivery vehicles. |
| `GET` | `/delivery/work` | Packages eligible for delivery (READY_FOR_DELIVERY items). |
| `GET` | `/delivery/runs/me/active` | This staff's active run. |
| `GET` | `/delivery/runs/me/loaded-packages` | Packages already loaded on this run. |
| `GET` | `/delivery/packages/:packageId` | Package detail. |
| `POST` | `/delivery/runs` | Open a new run (vehicle + staff). |
| `POST` | `/delivery/packages/:packageId/scan-outbound` | Outbound scan; gated by paid BASE billing. |
| `POST` | `/delivery/packages/:packageId/handoff` | Customer handoff. |
| `POST` | `/delivery/packages/:packageId/handoff-photo` | Attach customer handoff photo (`DeliveryHandoffPhoto` — one per package). |
| `POST` | `/delivery/runs/:runId/close` | Close the run. |

## Tables

`delivery_vehicles`, `delivery_runs`, `delivery_run_items`,
`delivery_handoff_photos` (one row per `package_id`).

Seed vehicles: `DELIVERY_VAN_01`, `DELIVERY_VAN_02`, `DELIVERY_VAN_03`.

## Module

`DeliveryModule` imports `PrismaModule`, `AuthModule`, and
`ProcessingRouteModule` (for `AuditLogger`). Billing-paid check is enforced
inline against `billing_requests`.
