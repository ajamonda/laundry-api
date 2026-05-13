# Audit / Event

Cross-domain bookkeeping. No dedicated module — `AuditLogger` lives in `processing-route` and is injected everywhere else.

## Tables (owned)
- `audit_logs` — general business audit
- `item_process_events` — per-item processing timeline (plan/step lifecycle)

A single business action typically writes both. Different consumers:

| Table | Read by |
|---|---|
| `audit_logs` | Admin tooling, compliance queries; `GET /audit-logs` (ADMIN) |
| `item_process_events` | Staff/customer item timeline view; `GET /items/:id/processing/events` (WASH) |

## Actor snapshot (shared shape)

```ts
{ actorType: 'CUSTOMER' | 'STAFF', actorId: string, staffRole: StaffRole | null }
```
- Customer rows: `staffRole = null`.
- Staff rows: `staffRole = <role used by the auth guard>`.

## `actionType` / `targetType`

Both are free-form strings. Each domain registers its own keywords without schema migration. **Authoritative list per domain README.**

## Required usage

Every state mutation that owns a business meaning writes an audit row in the same transaction:

```ts
await this.auditLogger.logInTransaction(tx, {
  actor,
  actionType: 'ITEM_TAGGED',
  targetType: 'ORDER_ITEM',
  targetId: orderItemId,
  beforeState: { status: 'PICK_UP' },
  afterState:  { status: 'TAGGED', tagBarcode },
});
```

**Never** call `AuditLogger.logInTransaction` outside a `$transaction`. The whole point is atomicity with the business write.

## Coverage matrix

| Domain | Writes audit_logs? | Writes item_process_events? |
|---|---|---|
| catalog | (order creation events via processing-route `createPlan`) | yes (via `createPlan`) |
| pickup | yes (`ITEM_PICKED_UP`, `ITEMS_PUT_INTO_BAG`, `BAG_HANDED_OFF`, etc.) | no |
| processing-route | yes (`PLAN_CREATED`, `STEP_COMPLETED`, `OVERRIDE_ACTIVATED`, `PLAN_SUPERSEDED`, etc.) | yes (the timeline source) |
| wash | yes (`ITEM_TAGGED`) | indirect via `RouteEngineService` |
| exception | yes (via `RouteEngineService` calls) | yes (via `RouteEngineService` calls) |
| billing | yes (`BILLING_CREATED`, `BILLING_PAID`, `BILLING_CANCELLED`) — emitted as `payment_events` rows, separate stream | no |
| delivery | yes (`ITEM_SCAN_OUTBOUND`, `ITEM_HANDED_OFF`) | no |

Note: `payment_events` is a billing-domain timeline table, not `audit_logs`. The general audit log records the action; `payment_events` records the side stream that the billing UI/state machine consumes.

## Read endpoint

| Method | Path | Guard | Notes |
|---|---|---|---|
| `GET` | `/audit-logs?targetType=&targetId=&actorId=&limit=&cursor=` | StaffAuthGuard, `ADMIN` | cursor = ISO timestamp of last row; `timestamp DESC` |

## When you change this domain

- Adding a new `AuditLog` action emitter → list the keyword in the emitter's domain README. Don't track it here.
- Schema change to `audit_logs` or `item_process_events` → update [processing-route/README.md](../processing-route/README.md) (the engine owns the events) + migration + seed if applicable.
- New consumer of audit data → cursor pagination is the only supported access pattern; do not add unfiltered `findMany`.
