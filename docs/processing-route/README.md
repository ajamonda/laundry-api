# Processing Route

`src/modules/processing-route/` — route templates, per-item runtime state, audit logging.

## Tables
- `processing_routes`, `processing_route_steps` (templates)
- `item_processing_plans`, `item_processing_states`, `item_process_events` (runtime)
- `audit_logs` (general audit)
- `item_processing_overrides` is **owned by exception** but the engine reads/mutates it during step advancement.

## Exports
| Symbol | Used by |
|---|---|
| `RouteEngineService` | `catalog` (`CreateOrderUseCase`), `wash`, `exception`, `delivery` (transitive) |
| `AuditLogger` | every domain — pass `tx` into `logInTransaction(tx, ...)` |

## Seed routes (13)

| Code | Steps (after SORTED) |
|---|---|
| `GENERAL_CLOTHES_CLEANING` | WASHING → AIR_DRYING → PRESSING → INSPECTING → READY_TO_PACKAGE |
| `REPAIR_AND_CLEANING` | REPAIRING → WASHING → AIR_DRYING → PRESSING → INSPECTING → READY_TO_PACKAGE |
| `PREMIUM_CLEANING` | PREMIUM_WASHING → PREMIUM_DRYING → PREMIUM_PRESSING → PREMIUM_INSPECTING → READY_TO_PACKAGE |
| `REPAIR_AND_PREMIUM_CLEANING` | REPAIRING → 4× premium → READY_TO_PACKAGE |
| `STANDARD_SHOES_CLEANING` | WASHING → AIR_DRYING → INSPECTING → READY_TO_PACKAGE |
| `REPAIR_AND_SHOES_CLEANING` | REPAIRING → WASHING → AIR_DRYING → INSPECTING → READY_TO_PACKAGE |
| `PREMIUM_SHOES_CLEANING` | PREMIUM_WASHING → PREMIUM_DRYING → PREMIUM_INSPECTING → READY_TO_PACKAGE |
| `REPAIR_AND_PREMIUM_SHOES_CLEANING` | REPAIRING → 3× premium → READY_TO_PACKAGE |
| `OUTSOURCED_CLEANING` | vendor (3 steps) → WASHING → AIR_DRYING → INSPECTING → READY_TO_PACKAGE |
| `OUTSOURCED_PREMIUM_SHOES_CLEANING` | vendor → 3× premium → READY_TO_PACKAGE |
| `OUTSOURCED_ONLY_CLEANING` | vendor → INSPECTING → READY_TO_PACKAGE |
| `QUICK_LAUNDRY` | WASHING → MACHINE_DRYING → INSPECTING → READY_TO_PACKAGE |
| `SECOND_HAND_PROCESSING` | single step `FINISHED` |

`READY_TO_PACKAGE` step is auto-completed inside `scan-step` (operators never scan past it).

## When plans are created
- Default path: `CreateOrderUseCase` calls `createPlan` for each item whose route resolves via `route_resolution_rules`.
- Fallback path: `POST /wash/tags/:tag/assign-route` (wash domain), for items whose route was not resolved at order time.

## `RouteEngineService` API

| Method | Effect |
|---|---|
| `createPlan(orderItemId, routeCode, actor, reason?)` | ACTIVE plan + state, first step IN_PROGRESS, emits `PLAN_CREATED` + `STEP_STARTED`, audit `PLAN_CREATED` |
| `getCurrentState(orderItemId)` | Read-only snapshot (still opens a tx for FOR UPDATE consistency) |
| `startCurrentStep(orderItemId, actor)` | Idempotent — no-op if already IN_PROGRESS |
| `completeCurrentStep(orderItemId, actor)` | Completes current ROUTE or OVERRIDE step, advances via `findNextStep`. Returns `isPlanCompleted`. |
| `switchRoute(orderItemId, newRouteCode, actor, reason)` | Marks current plan SUPERSEDED + creates a new ACTIVE plan. Used by route-change approval. |
| `activateOverrides(input)` | Adds an ACTIVE override row, flips state source to OVERRIDE. |
| `skipRemainingOverrides(input)` | Marks remaining overrides SUPERSEDED, returns to ROUTE. |

All methods open their own `$transaction`. Every state mutation lives behind `loadState` which acquires `SELECT ... FOR UPDATE` on `item_processing_states.order_item_id` to serialize concurrent callers (`completeCurrentStep`, `activateOverrides`, `skipRemainingOverrides`, `switchRoute`, `startCurrentStep`).

## `findNextStep` algorithm

Given `(currentSortOrder, planRouteId)`:
1. Load any ACTIVE override row (`item_processing_overrides WHERE status='ACTIVE'`).
2. If override's `sortOrder > currentSortOrder` → that override is the next step.
3. Else if `sortOrder === currentSortOrder` → peek the override's flow template for the next step at `offset > currentOffset`. If exhausted, pop to the previous override in the stack; if no overrides left, fall through to ROUTE.
4. Compute next ROUTE step (`processing_route_steps WHERE sortOrder > current ORDER BY sortOrder ASC LIMIT 1`).
5. Whichever has lower `sortOrder` wins; both null → plan completes.

Multiple ACTIVE overrides stack — they resolve in `sortOrder` (LIFO via `createdAt DESC`).

## `AuditLogger`

```ts
auditLogger.logInTransaction(tx, {
  actor,         // ActorContext
  actionType,    // free-form string (e.g. 'PLAN_CREATED', 'ITEM_TAGGED', 'BILLING_PAID')
  targetType,    // free-form string (e.g. 'ORDER_ITEM', 'BILLING_REQUEST')
  targetId,
  beforeState?, // JSONB
  afterState?,  // JSONB
  reason?,
  metadata?,
});
```

`actionType` / `targetType` are intentionally strings — every domain registers its own keywords without schema migration. Each domain documents the keywords it emits in its own README.

## Read endpoints

| Method | Path | Guard |
|---|---|---|
| `GET` | `/processing-routes` | StaffAuthGuard, any role |
| `GET` | `/processing-routes/:code` | StaffAuthGuard, any role |
| `GET` | `/items/:id/processing` | StaffAuthGuard, `WASH` |
| `GET` | `/items/:id/processing/events` | StaffAuthGuard, `WASH` |
| `GET` | `/audit-logs?targetType=&targetId=&actorId=&limit=&cursor=` | StaffAuthGuard, `ADMIN` |

Audit-log list is cursor-paginated by ISO timestamp (`timestamp DESC`).

## Invariants

- Exactly one plan per item is ACTIVE at any time. Enforced by `createPlan` which throws `PlanAlreadyExistsError` if it finds another ACTIVE.
- `loadState` always acquires the row lock first. Don't add a code path that reads `item_processing_states` and then writes without going through `loadState`.
- `currentRouteStepId` is null when `currentStepSource = 'OVERRIDE'`. `currentOverrideId` is null when `currentStepSource = 'ROUTE'`. The pair is mutually exclusive.

## When you change this domain

- New route → seed `processing_routes` + `processing_route_steps` in `prisma/seed.ts`. Add a row to the table above.
- New step type → string only (no enum). Document the meaning in the seed comment.
- New `RouteEngineService` method → must call `loadState` for FOR UPDATE; must call `AuditLogger.logInTransaction` inside the same tx; export via `ProcessingRouteModule`.
- Changing `findNextStep` → also update [exception-flow/README.md](../exception-flow/README.md) (it documents the same algorithm).
