# Exception Flow

`src/modules/exception/` — two mid-process customer-facing flows: **override flows** (in-place detour on the current route) and **route changes** (full plan replacement).

## Tables (owned)
- `exception_flow_templates`, `exception_flow_template_steps` (templates, seeded)
- `item_issues`, `approval_requests`, `item_exception_contexts`
- `route_change_requests`
- `item_processing_overrides` (read+write by both this domain and `RouteEngineService.findNextStep`)

## Two flows

| Flow | Trigger state | Side effects |
|---|---|---|
| Override | `WashSide`: `request-route-change` is **not** allowed; activate-exception-flow needs item `SORTED` or `PROCESSING` | Inserts an `item_processing_overrides` ACTIVE row; flips state source to OVERRIDE; emits `STEP_STARTED`; if template has `WAIT_CUSTOMER_DECISION`, creates `approval_requests` row + WS push |
| Route change | item `SORTED` or `PROCESSING`; no PENDING route change exists; state source is not OVERRIDE | Inserts `route_change_requests` PENDING; WS push to customer |

## Override step model

One ACTIVE override row per running flow on an item. The row advances **in place** as the operator scans through the template:
- `flowCode` — template code
- `currentOffset` — current position within template
- `stepType`, `displayName`, `sortOrder` — denormalized for `findNextStep`
- `baseStepSortOrder` — the ROUTE step at which the override was inserted
- `status` — `ACTIVE` | `COMPLETED` | `SUPERSEDED`

Multiple ACTIVE overrides stack on the same item — resolved by `findNextStep` (see [processing-route](../processing-route/README.md#findnextstep-algorithm)).

## Approval decisions

| decision | Effect |
|---|---|
| `APPROVE_REPAIR` / `APPROVE_VENDOR` / `APPROVE_PREMIUM` | `RouteEngineService.completeCurrentStep` (advances OVERRIDE). If `extraAmount > 0`, `BillingService.createSupplementBillingForApproval` (SUPPLEMENT, `notifiedAt=null`) |
| `CLEAN_WITHOUT_REPAIR` / `APPROVE_AS_IS` | `RouteEngineService.skipRemainingOverrides` (drops remaining override; returns to ROUTE); resolve `item_exception_contexts` |
| `RETURN_WITHOUT_PROCESSING` | Same as above — skip remaining + resolve context |

## Route-change approve decision

| Effect | Where |
|---|---|
| CAS `route_change_requests` PENDING → APPROVED | top of `ApproveRouteChangeUseCase` |
| `RouteEngineService.switchRoute` (current plan SUPERSEDED, new ACTIVE plan) | `ApproveRouteChangeUseCase` |
| `orderItemOption` swap of `cleaning_method` (matches new route via `ROUTE_CLEANING_METHOD` map) | `ApproveRouteChangeUseCase` |
| `BillingService.createSupplementBillingForRouteChange` if `additionalCost !== 0` | `ApproveRouteChangeUseCase` |
| `orderItem.estimatedMinAmount += additionalCost` | `ApproveRouteChangeUseCase` — **running total for wash-web's next-route-change form math**, not the BASE billed amount |

## Endpoints

| Method | Path | Guard | Notes |
|---|---|---|---|
| `POST` | `/wash/items/:id/raise-issue` | Staff `WASH` | Records `item_issues` row only; no state change |
| `POST` | `/wash/items/:id/activate-exception-flow` | Staff `WASH` | `{ flowCode }` — creates override + optional approval request |
| `GET` | `/wash/approval-requests` | Customer | Customer's WAITING approval requests (reconnect-recovery) |
| `POST` | `/wash/approval-requests/:id/respond` | Customer | `{ decision, extraAmount? }` |
| `POST` | `/wash/items/:id/request-route-change` | Staff `WASH` | `{ toRouteCode, additionalCost?, reason }` |
| `GET` | `/wash/route-change-requests/pending` | Customer | Customer's PENDING route-change requests (reconnect-recovery) |
| `POST` | `/wash/route-change-requests/:id/approve` | Customer | |
| `POST` | `/wash/route-change-requests/:id/reject` | Customer | Records REJECTED status only; no plan/billing side effect |

## Scan-step blockers

When the wash domain's `scan-step` runs, it queries this domain:

| Condition | Throws |
|---|---|
| Current step is `WAIT_CUSTOMER_DECISION` (override) | `ItemAwaitingCustomerDecision` (409) |
| `route_change_requests` row exists with `status='PENDING'` for this item | `ItemHasPendingRouteChange` (409) |

## WebSocket

Namespace `/exception`. Room `customer:${customerId}`.

| Event | Direction | Payload | Trigger |
|---|---|---|---|
| `exception:approval-requested` | server → client | `{ approvalRequestId, flowCode, itemId, options, additionalCost? }` | `activate-exception-flow` when template has `WAIT_CUSTOMER_DECISION` |
| `exception:approval-resolved` | server → client + wash staff broadcast | `{ approvalRequestId, decision, orderItemId }` | `respond-approval` |
| `exception:route-change-requested` | server → client | `{ routeChangeRequestId, itemId, fromRouteCode, toRouteCode, additionalCost, reason }` | `request-route-change` |
| `exception:route-change-resolved` | server → wash staff broadcast | `{ routeChangeRequestId, orderItemId, status }` | `approve-route-change` / `reject-route-change` |

## Race / idempotency guarantees

| Risk | Protection |
|---|---|
| Approval double-fire | CAS in `RespondApprovalUseCase`: `updateMany WHERE status='WAITING'` + throw on `count===0` |
| Route-change approve double-fire | CAS in `ApproveRouteChangeUseCase`: `updateMany WHERE status='PENDING'` + throw on `count===0` |
| Concurrent `request-route-change` for same item | Partial UNIQUE `(order_item_id) WHERE status='PENDING'` (migration `20260514120000_route_change_one_pending_per_item`) + `mapUniqueConflict` → `PendingRouteChangeExistsError`. The application's pre-check (`findFirst({ status: 'PENDING' })`) is a fast-fail optimisation only — the DB index is the authoritative guard |
| SUPPLEMENT duplicate creation | `BillingRequest` `UNIQUE(sourceType, sourceId)` ([billing](../billing/README.md)) |
| Concurrent override mutations | `loadState` `SELECT ... FOR UPDATE` in `RouteEngineService` |

## Seed templates (11)

`REPAIR_APPROVAL_FLOW`, `VENDOR_APPROVAL_FLOW`, `PREMIUM_APPROVAL_FLOW`, `REWASH_FLOW`, `ADDITIONAL_REPAIR_FLOW`, `ADDITIONAL_VENDOR_FLOW`, `DAMAGE_RISK_APPROVAL_FLOW`, `STAIN_REMOVAL_FAILED_FLOW`, `PAYMENT_FAILED_FLOW`, `PAYMENT_PENDING_FLOW`, `RETURN_WITHOUT_PROCESSING_FLOW`. Step types are free-form strings — meaning lives in `prisma/seed.ts`.

## Anti-pattern

- **Do not use `REPAIR_APPROVAL_FLOW` in tests that need to scan past the approval step.** The seed has two consecutive `WAIT_CUSTOMER_DECISION` steps; a single approval response advances to the second, and `scan-step` blocks on the second. Use route-change for SUPPLEMENT-creation tests instead.

## When you change this domain

- New flow template → seed in `prisma/seed.ts` + add to the list above. Step types are strings; no migration needed.
- New approval decision → update `APPROVE_DECISIONS` / `SKIP_DECISIONS` sets in `RespondApprovalUseCase` + this README's decision table.
- New side effect on approve → update the side-effect table; if it touches billing, also update [billing/README.md](../billing/README.md).
