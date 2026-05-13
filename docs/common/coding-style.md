# Coding Style

`laundry-api` is a pragmatic DDD modular monolith. Domain boundaries are
enforced by folder + import discipline, not by separate services.

## Module Structure

Every domain under `src/modules/<domain>/` follows the same four-layer split:

```text
interfaces/http   = controllers + class-validator DTOs
interfaces/ws     = socket.io gateways (billing, exception)
application       = use cases (one class per business action) + facades
domain            = types, policies, repository ports (interfaces only), errors, domain services
infrastructure    = Prisma repositories, external adapters
```

`src/common/` is reserved for cross-cutting concerns (auth, errors, etc.).
`src/database/` holds Prisma module + service.

## Dependency Rules

- Controllers call use cases only — no business logic in controllers.
- Domain code does not know NestJS, Prisma, HTTP DTOs, or cache adapters.
- Prisma types must not leak past `infrastructure/`.
- **Domains never import another domain's internal services or repositories.**
  Cross-domain calls go through a small exported facade/service (sync) or
  domain events (async). Currently exported across domains:
  - `RouteEngineService`, `AuditLogger` from `processing-route`
  - `BillingService` from `billing`

## Repository Pattern

```text
modules/<domain>/
  domain/<name>.repository.ts          # interface + DI symbol token (e.g. WASH_REPOSITORY)
  infrastructure/prisma-<name>.repository.ts
```

Inject via tokens. Tests can bind the same port to a fake.

## Audit Writes

Every business state change writes its AuditLog row in the **same
transaction** via `AuditLogger.logInTransaction(tx, params)`. Callers pass
their own `Prisma.TransactionClient` — never write AuditLog after the tx
commits.

## API Style

- Action-oriented endpoints (`scan-step`, `assign-route`, `respond`,
  `handoff`, `activate-exception-flow`) — not `PUT /items/:id`.
- Korean for user-facing display strings; English `snake_case` for codes /
  IDs / DB columns.
- Customer-vs-staff guards must not be mixed. A customer token must not call
  staff APIs and vice versa.

## Test Direction

- Unit: pure domain policies.
- Application: use cases with repository fakes or a test DB.
- Repository contract tests when caching is introduced.
- Integration: facade/event boundaries.
- E2E: full flow (order → pickup → wash → billing → delivery) plus exception
  and route-change variants.
- Auth: customer tokens cannot hit staff APIs; staff role guards reject the
  wrong operational role.

## Known Foot-guns

- `LaundryOrder.customer_id` is a UUID PK, **not** the human `customerId`.
  Ownership checks (billing, exception, route-change) must traverse
  `order.customer.customerId`. A past 403 bug came from this confusion.
- `tagItem`, `assignRoute`, and `scanStep` each do two separate writes
  (route-engine tx + item-status update). Inconsistent state on failure is
  an accepted MVP risk.
- Seeding: both `npx prisma db seed` and `npm run prisma:seed` work; the
  former is wired via the `prisma.seed` block in `package.json`.
