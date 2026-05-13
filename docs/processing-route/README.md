# Processing Route

The processing-route domain owns the normal factory workflow as DB templates
and per-item runtime state. It is also the home of `AuditLogger`.

## Concepts

- **`processing_routes`** — route template (e.g. `GENERAL_CLOTHES_CLEANING`).
- **`processing_route_steps`** — ordered steps in a route, by `sortOrder`.
- **`item_processing_plans`** — per-item record of which route was applied
  (history; at most one `ACTIVE` per item, enforced by application logic).
- **`item_processing_states`** — current position of an item (one row per item).
- **`item_process_events`** — append-only timeline (plan/step lifecycle).
- **`item_processing_overrides`** — exception-flow rows attached to an item;
  see [exception-flow](../exception-flow/README.md).

## Seed Routes (`prisma/seed.ts`)

13 routes seeded. All but `SECOND_HAND_PROCESSING` end with a literal
`READY_TO_PACKAGE` step that `scan-step` auto-completes (operators do not
need to scan past it).

| code | summary |
|---|---|
| `GENERAL_CLOTHES_CLEANING` | WASHING → AIR_DRYING → PRESSING → INSPECTING → READY_TO_PACKAGE |
| `REPAIR_AND_CLEANING` | REPAIRING → WASHING → AIR_DRYING → PRESSING → INSPECTING → READY_TO_PACKAGE |
| `PREMIUM_CLEANING` | PREMIUM_WASHING → PREMIUM_DRYING → PREMIUM_PRESSING → PREMIUM_INSPECTING → READY_TO_PACKAGE |
| `REPAIR_AND_PREMIUM_CLEANING` | REPAIRING → 4× premium → READY_TO_PACKAGE |
| `STANDARD_SHOES_CLEANING` | WASHING → AIR_DRYING → INSPECTING → READY_TO_PACKAGE |
| `REPAIR_AND_SHOES_CLEANING` | REPAIRING → WASHING → AIR_DRYING → INSPECTING → READY_TO_PACKAGE |
| `PREMIUM_SHOES_CLEANING` | PREMIUM_WASHING → PREMIUM_DRYING → PREMIUM_INSPECTING → READY_TO_PACKAGE |
| `REPAIR_AND_PREMIUM_SHOES_CLEANING` | REPAIRING → 3× premium → READY_TO_PACKAGE |
| `OUTSOURCED_CLEANING` | WAITING_FOR_VENDOR → HAND_OVER → TAKE_OVER → WASHING → AIR_DRYING → INSPECTING → READY_TO_PACKAGE |
| `OUTSOURCED_PREMIUM_SHOES_CLEANING` | vendor steps → 3× premium → READY_TO_PACKAGE |
| `OUTSOURCED_ONLY_CLEANING` | vendor steps → INSPECTING → READY_TO_PACKAGE |
| `QUICK_LAUNDRY` | WASHING → MACHINE_DRYING → INSPECTING → READY_TO_PACKAGE |
| `SECOND_HAND_PROCESSING` | single step `FINISHED` |

When `scan-step` completes the final step (or `isPlanCompleted` triggers via
the READY_TO_PACKAGE auto-completion), the wash domain flips item status
`PROCESSING → READY_TO_PACKAGE`; `POST /wash/packages` then groups items
into `ItemPackage` rows and moves them to `READY_FOR_DELIVERY`.

## Plan Lifecycle

A plan is normally created at **order creation time** by `CreateOrderUseCase`
when the catalog can resolve a route from the item code + selected options
(see [catalog](../catalog-pricing/README.md#catalog--processing-route-link)).
For items whose route cannot be resolved, the plan is created later by the
fallback `/wash/tags/:tag/assign-route` endpoint after tagging.

## Step Advancement — `findNextStep`

When the current step (ROUTE or OVERRIDE) completes, the engine picks the
next step by integrating ROUTE steps and ACTIVE overrides:

1. For any ACTIVE override row, the next template step (by `currentOffset`)
   is computed.
2. The next ROUTE step (`sortOrder > current`) is computed.
3. Whichever has the lower `sortOrder` wins. If only ROUTE remains, the
   plan completes when no further ROUTE step exists.

This means override completion can naturally return to the next ROUTE step,
and multiple ACTIVE overrides can be stacked (e.g. REPAIR mid-flow, then
VENDOR on top) and resolve in `sortOrder` order.

## `RouteEngineService` (exported)

| Method | Purpose |
|---|---|
| `createPlan(orderItemId, routeCode, actor, reason?)` | Creates ACTIVE plan + state, marks first step IN_PROGRESS, emits `PLAN_CREATED` + `STEP_STARTED`. Called by `CreateOrderUseCase` (auto) and `AssignRouteUseCase` (fallback). |
| `getCurrentState(orderItemId)` | Read-only snapshot. |
| `startCurrentStep(orderItemId, actor)` | Idempotent — no-op if already IN_PROGRESS. |
| `completeCurrentStep(orderItemId, actor)` | Completes current ROUTE/OVERRIDE step, advances via `findNextStep`, marks plan complete when exhausted. |
| `switchRoute(orderItemId, newRouteCode, actor, reason)` | Marks current plan SUPERSEDED + creates a new ACTIVE plan. Used by route-change approval. |
| `activateOverrides(input)` | Adds a new ACTIVE override row, flips state source to OVERRIDE. |
| `skipRemainingOverrides(input)` | Marks remaining overrides SUPERSEDED, returns to ROUTE. |

## `AuditLogger` (exported)

`logInTransaction(tx, { actor, actionType, targetType, targetId, beforeState?, afterState?, reason? })`.
Callers pass their own `Prisma.TransactionClient` so audit is atomic with the
business change.

## HTTP API (read-only)

| Method | Path | Guard |
|---|---|---|
| `GET` | `/processing-routes` | StaffAuthGuard (any role) |
| `GET` | `/processing-routes/:code` | StaffAuthGuard (any role) |
| `GET` | `/items/:id/processing` | StaffAuthGuard, `WASH` |
| `GET` | `/items/:id/processing/events` | StaffAuthGuard, `WASH` |
| `GET` | `/audit-logs` | StaffAuthGuard, `ADMIN` |

Audit-log list is cursor-paginated by ISO timestamp, `timestamp DESC`.

## Module

`ProcessingRouteModule` exports `RouteEngineService` and `AuditLogger`.
`CatalogModule`, `WashModule`, `ExceptionModule`, `BillingModule`, and
`DeliveryModule` import it.
