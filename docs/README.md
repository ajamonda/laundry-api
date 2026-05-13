# laundry-api docs index

Engineering specs for harness work. Source of truth for schema is
`prisma/schema.prisma`; for endpoints, the `*.controller.ts` files. Docs
encode invariants, wiring, and anti-patterns — facts the code does not
make obvious.

## Read order before editing any code

1. [common/architecture.md](./common/architecture.md) — stack, layout, runtime concerns.
2. [common/coding-style.md](./common/coding-style.md) — layer rules, DI tokens, transaction discipline, foot-guns.
3. [common/test.md](./common/test.md) — required checks after every change.
4. The README of the domain you are editing.

## Domains

| Domain | Path | Owns (DB) | Exports |
|---|---|---|---|
| [auth-actor](./auth-actor/README.md) | `src/modules/auth/` | `customers`, `staff` | (guards only) |
| [catalog-pricing](./catalog-pricing/README.md) | `src/modules/catalog/` | `catalog_*`, `orders`, `order_items*`, `route_resolution_rules` | — |
| [pickup](./pickup/README.md) | `src/modules/pickup/` | `pickup_*` | — |
| [processing-route](./processing-route/README.md) | `src/modules/processing-route/` | `processing_routes*`, `item_processing_*`, `audit_logs`, `item_process_events` | `RouteEngineService`, `AuditLogger` |
| [exception-flow](./exception-flow/README.md) | `src/modules/exception/` | `exception_flow_templates*`, `item_processing_overrides`, `item_issues`, `approval_requests`, `item_exception_contexts`, `route_change_requests` | — |
| [wash-factory](./wash-factory/README.md) | `src/modules/wash/` | (uses `order_items`) | — |
| [billing](./billing/README.md) | `src/modules/billing/` | `billing_requests*`, `payment_events` | `BillingService` |
| [delivery](./delivery/README.md) | `src/modules/delivery/` | `delivery_*` | — |
| [audit-event](./audit-event/README.md) | (cross-domain) | `audit_logs`, `item_process_events` | (re-exported via processing-route) |

## Hard rules (apply to every change)

- Read the domain README before editing files in that domain.
- Cross-domain calls go through exported services only (table above). Never `import` another domain's repository / use case / Prisma type.
- Schema changes → Prisma migration + seed update + [test/utils/db.ts](../test/utils/db.ts) `DELETE_ORDER` review.
- `npm run typecheck && npm run test:e2e` must pass before the PR is ready.
- Spec line in a README ↔ test in `test/e2e/*` — keep the mapping. New invariant without a test = dead text.
