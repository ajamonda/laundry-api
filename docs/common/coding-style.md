# Coding Style — Rules

DDD-ish modular monolith. The rules below are enforced by code review, not by tooling. Break them and the next race / refactor pays the cost.

## Layer rules

Per domain at `src/modules/<domain>/`:

| Layer | Path | Allowed dependencies |
|---|---|---|
| `interfaces/http/` | controllers + DTOs | application |
| `interfaces/ws/` | gateways | application, JwtService |
| `application/use-cases/` | one class per action | domain |
| `domain/` | types, policies, repository ports, errors, exported services | (none — pure) |
| `infrastructure/` | Prisma repositories | domain, PrismaService |

Specific bans:
- **Controllers must not access Prisma or repositories directly.** Call a use case.
- **Use cases must not perform DB queries through `PrismaService`.** All reads/writes go through repositories. The one allowed `PrismaService` usage in a use case is **opening a transaction boundary** (`this.prisma.$transaction(async (tx) => ...)`) and threading the `tx` into repository / service calls so multi-step writes are atomic. See `wash/.../tag-item.use-case.ts`, `assign-route.use-case.ts`, `scan-step.use-case.ts` for the canonical pattern. The use case itself must not call `tx.<model>.X` directly — only repositories do that.
- **`domain/` must not import from `@prisma/client`** except for the enum types (`OrderItemStatus`, `OrderStatus`, etc.) and `Prisma.TransactionClient` (the type carried through `tx?` parameters). Both are shared knowledge, not runtime client code.
- **No `any` types** in production code. If a Prisma return type is hard to express, use `Prisma.<Model>GetPayload<{ include: ... }>`.

## Cross-domain rules

- **Domains never import another domain's repositories, use cases, or types.** Only the exported service.
- Current exports (everything else is internal):
  - `RouteEngineService`, `AuditLogger` from `processing-route` (exported by `ProcessingRouteModule`).
  - `BillingService` from `billing` (exported by `BillingModule`).
- Adding a new exported service: declare in `<domain>.module.ts` `exports:`, document in the domain README, update [docs/README.md](../README.md) "Exports" column.

## Transaction rules

- **Audit and the business write must be in the same transaction.** Pass `Prisma.TransactionClient` into `AuditLogger.logInTransaction(tx, ...)`. Never call `AuditLogger` outside a tx.
- **A use case's writes are one transaction.** If a use case performs more than one write (repository or cross-domain service call that writes), it opens a single `prisma.$transaction` and threads the `tx` into every sub-call. Multi-write use cases that leave atomicity to "each repo call has its own tx" are forbidden — that was the wash-domain MVP gap, now fixed.
- **Repositories and exported services that participate in multi-step flows accept an optional `tx?: Prisma.TransactionClient`.** Implementation pattern: `const work = (client) => ...; return tx ? work(tx) : this.prisma.$transaction(work);`. Behaviour with and without `tx` must be identical except for the transaction boundary. Do not branch behaviour on the presence of `tx`.
- **Side-effects (WebSocket emit, HTTP call, queue publish) never run inside `prisma.$transaction`.** Inside the tx, build a payload and return it; fire the side-effect after `$transaction` resolves. Canonical split: `BillingService.claimWaitingForReadyToPackage(... , tx)` returns a payload, `BillingService.emitReadyToPackage(payload)` runs post-commit. A rolled-back tx must never produce a customer-visible notification.
- **`SELECT ... FOR UPDATE`** is used in `RouteEngineService.loadState` to serialize concurrent mutations on the same item. Apply the same pattern when adding any new read-then-write on a shared row.
- **CAS pattern for status flips**: `tx.<model>.updateMany({ where: { id, status: 'WAITING' }, data: { status: 'NEXT' } })` + throw if `count === 0`. Used by `BillingRepository.resolveRequest`, `RespondApprovalUseCase`, `ApproveRouteChangeUseCase`. Apply to every new "X must move from state A to state B exactly once" code path.
- **Default isolation level: PG `READ COMMITTED`.** Do not change global isolation. Per-tx override only with retry middleware (currently absent — don't introduce).
- **No nested `prisma.$transaction`.** If a sub-call receives `tx`, it must use `tx` directly — opening a fresh `prisma.$transaction` inside it does not nest in Prisma and silently breaks the caller's atomicity.

## Idempotency rules

- **Idempotency keys are DB UNIQUE constraints, not application-level checks.**
- BASE billing: `billing_request_items.order_item_id` UNIQUE.
- SUPPLEMENT billing: `billing_requests.(source_type, source_id)` UNIQUE.
- When you add a "must exist exactly one per X" rule, encode it as a UNIQUE index. Repository INSERT must catch P2002 and return the existing row.

## Authentication rules

- Customer and staff are different subjects. Never merge into one principal type.
- `CustomerAuthGuard` for customer routes (injects `CustomerPrincipal`).
- `StaffAuthGuard` + `@StaffRoles(...)` for staff routes (injects `StaffPrincipal`).
- Mixing guards on the same endpoint is forbidden. If a flow needs both perspectives, split into two endpoints.
- Ownership checks on customer-owned resources: traverse `order.customer.customerId`. **Never compare against `order.customer_id`** — that is a UUID PK, not the human customerId. Foot-gun confirmed by a past 403 bug.

## API shape rules

- Action-oriented endpoints (`scan-step`, `respond`, `handoff`, `assign-route`), not CRUD on status (`PUT /items/:id`).
- Korean for user-facing display strings. English `snake_case` for codes / IDs / DB columns.
- DTOs declared with `class-validator` decorators. Optional fields use `@IsOptional()`. Numbers use `@IsInt` or `@IsNumber`. Enums use `@IsIn([...])`.

## Foot-guns (read before editing)

- `LaundryOrder.customer_id` is a UUID PK. Ownership checks must traverse `order.customer.customerId`.
- `npx prisma db seed` works (the `prisma.seed` block in `package.json` was added). `npm run prisma:seed` is the explicit alias.
- The `_test` DB safety gate is in [test/load-env.ts](../../test/load-env.ts). Never bypass it.

## When you change this file

- New rule → add a row to one of the tables above. Do not write paragraphs.
- Removing a rule that has tests → also remove the tests, or migrate them.
