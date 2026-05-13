# Exception Flow

The exception domain covers two mid-process customer-facing flows:

1. **Override flows** — small detours that materialize as
   `item_processing_overrides` rows on top of the current route (repair
   approval, vendor approval, premium notice, rewash, …).
2. **Route changes** — full replacement of the active processing route
   (`switchRoute`), gated by customer approval and optional supplemental
   billing.

## Override Flow

### Templates

`exception_flow_templates` + `exception_flow_template_steps` (relative
`offset` per step). Seed includes flows such as `REPAIR_APPROVAL_FLOW`,
`VENDOR_APPROVAL_FLOW`, `PREMIUM_APPROVAL_FLOW`, `REWASH_FLOW`,
`ADDITIONAL_REPAIR_FLOW`, …

### Override Row Model

Each ACTIVE override row represents one in-flight exception flow on an item.
The row carries its current position (`flowCode`, `currentOffset`,
`stepType`, `sortOrder`, `displayName`, `baseStepSortOrder`) and advances
**in-place** as the operator scans through the template's steps. Multiple
ACTIVE overrides per item are allowed (stacked) and resolve in `sortOrder`
order — see `findNextStep` in
[../processing-route/README.md](../processing-route/README.md#step-advancement--findnextstep).

Override `status`:
- `ACTIVE` — currently advancing through its template.
- `COMPLETED` — last template step done.
- `SUPERSEDED` — skipped by `skipRemainingOverrides` (e.g. customer chose
  `CLEAN_WITHOUT_REPAIR`).

### Item Issues + Approval Requests

- `item_issues` records that a problem was raised (no state change on its own).
- `approval_requests` is the customer-facing decision request; emitted when a
  flow contains a `WAIT_CUSTOMER_DECISION` step and resolved via the
  customer-side respond endpoint.

### API

| Method | Path | Guard | Role |
|---|---|---|---|
| `POST` | `/wash/items/:id/raise-issue` | Staff | `WASH` |
| `POST` | `/wash/items/:id/activate-exception-flow` | Staff | `WASH` |
| `GET` | `/wash/approval-requests` | Customer | — (returns the customer's pending requests; used for socket-reconnect recovery) |
| `POST` | `/wash/approval-requests/:id/respond` | Customer | — |

`activate-exception-flow` body: `{ flowCode }`. Loads the template, computes
`baseStepSortOrder` from the current ROUTE step, creates the override row,
flips state to `OVERRIDE`, and emits `STEP_STARTED`. If the template includes
`WAIT_CUSTOMER_DECISION`, an `ApprovalRequest` is created and a socket event
is pushed.

While the current override step is `WAIT_CUSTOMER_DECISION`, the wash domain
blocks further scans on this item with `409 ItemAwaitingCustomerDecision`.

`respond` body: `{ decision, extraAmount? }`. Decision handling:

| Decision | Effect |
|---|---|
| `APPROVE_REPAIR` / `APPROVE_VENDOR` / `APPROVE_PREMIUM` | Advance the current OVERRIDE step. If `extraAmount > 0`, create a SUPPLEMENT billing request. |
| `CLEAN_WITHOUT_REPAIR` / `APPROVE_AS_IS` | Mark remaining overrides `SUPERSEDED`, return to ROUTE. |
| `RETURN_WITHOUT_PROCESSING` | Mark remaining overrides `SUPERSEDED` and resolve exception context. |

Ownership check on `respond`: traverse
`approvalRequest.orderItem.order.customer.customerId` — never compare against
`order.customer_id` (UUID PK foot-gun).

## Route Change Flow

When the operator decides the item belongs on a different route entirely
(e.g. discovered repair need → switch from `GENERAL_CLOTHES_CLEANING` to
`REPAIR_AND_CLEANING`), they raise a `RouteChangeRequest`. The customer
approves or rejects. On approval, `RouteEngineService.switchRoute` runs:
current plan → `SUPERSEDED`, new plan → `ACTIVE`.

### API

| Method | Path | Guard | Role |
|---|---|---|---|
| `POST` | `/wash/items/:id/request-route-change` | Staff | `WASH` |
| `GET` | `/wash/route-change-requests/pending` | Customer | — (the customer's PENDING requests) |
| `POST` | `/wash/route-change-requests/:id/approve` | Customer | — |
| `POST` | `/wash/route-change-requests/:id/reject` | Customer | — |

`request-route-change` body: `{ toRouteCode, additionalCost?, reason }`. The
catalog item's default route (auto-resolved from item + options at order
creation) provides the typical starting route; route-change is the path for
changing it after tagging.

While a `RouteChangeRequest` is PENDING on an item, `scan-step` is blocked
with `409 ItemHasPendingRouteChange`. On approve, `additionalCost > 0`
creates a SUPPLEMENT billing.

## WebSocket — `/exception`

- Auth: `socket.handshake.auth.token` (Bearer JWT, CUSTOMER subject).
- Room: `customer:${customerId}`.

| Event | Direction | Payload |
|---|---|---|
| `exception:approval-requested` | server → client | `{ approvalRequestId, flowCode, itemId, options }` |
| `exception:approval-resolved` | server → client | `{ approvalRequestId, decision, orderItemId }` |

Route-change requests reuse approval-request semantics — see the controller
for current event names if you wire frontend listeners.
