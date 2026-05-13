# Audit / Event

Two append-only tables capture who-did-what across the system:

- **`audit_logs`** — general operational audit, written by every business
  state change. Queried by `(targetType, targetId)` or by actor.
- **`item_process_events`** — per-item processing timeline (plan/step
  lifecycle), surfaced to staff/customer UIs.

A single business action typically writes both rows in the same transaction.

## Actor Snapshot

Both tables share the actor shape:

```ts
{ actorType: 'CUSTOMER' | 'STAFF', actorId: string, staffRole: StaffRole | null }
```

Customer rows have `staffRole = null`; staff rows carry the role used for
authorization. `actionType` and `targetType` on `audit_logs` are free-form
strings (intentionally, so each domain can register its own keywords without
a schema migration).

## `AuditLogger`

Implemented at `src/modules/processing-route/domain/audit-logger.ts` and
exported from `ProcessingRouteModule`. Other domains inject it directly —
they do not own audit infrastructure.

```ts
auditLogger.logInTransaction(tx, {
  actor,
  actionType,    // e.g. 'PLAN_CREATED', 'ITEM_TAGGED', 'BILLING_PAID'
  targetType,    // e.g. 'ORDER_ITEM', 'BILLING_REQUEST'
  targetId,
  beforeState?,  // JSONB
  afterState?,   // JSONB
  reason?,
  metadata?,
});
```

The caller always passes its own `Prisma.TransactionClient` so the audit row
is atomic with the business write.

## API

| Method | Path | Guard |
|---|---|---|
| `GET` | `/audit-logs?targetType=&targetId=&actorId=&limit=&cursor=` | Staff, `ADMIN` only |

Cursor is the ISO timestamp of the last row; ordered by `timestamp DESC`.

## Coverage

- `RouteEngineService` writes AuditLog rows for `createPlan`,
  `completeCurrentStep`, `activateOverrides`, `skipRemainingOverrides`,
  `switchRoute`.
- `WashModule` writes for `tag-item`, `assign-route`, `scan-step`,
  `packages`.
- `BillingModule`, `ExceptionModule`, `DeliveryModule`, `PickupModule` each
  write for their own business actions.
- Failed validation must not produce a successful audit row — write in the
  same transaction as the state change.
