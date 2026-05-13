# Catalog / Pricing / Orders

`src/modules/catalog/` — owns catalog, pricing estimate, and order creation.

## Tables
- `catalog_items`, `catalog_option_groups`, `catalog_options`, `catalog_option_prices`, `catalog_option_rules`, `catalog_item_inputs`
- `order_request_options`
- `orders` (`LaundryOrder`), `order_items`, `order_item_options`, `order_item_inputs`, `order_item_photos`, `order_item_price_snapshots`
- `route_resolution_rules`

## Conventions
- API/DB codes: English `snake_case`.
- Display strings: Korean.
- All prices: KRW integers.

## Price types (`CatalogPriceType`)

| Type | Shape |
|---|---|
| `FIXED` | single `amount` |
| `RANGE` | `minAmount` + `maxAmount`; estimates surface both |
| `UNIT` | `baseAmount` for up to `baseQuantity` `baseUnit`, plus `extraUnitAmount` per `extraUnitQuantity` |
| `MATRIX` | encoded via parent/child option nesting (`catalog_options.parent_option_id`) |
| `NONE` | non-priced inputs/options |

When any selected option has `RANGE` pricing, the estimate response carries `estimated_min_amount` and `estimated_max_amount`.

## Route auto-resolution

`CreateOrderUseCase` calls `PrismaCatalogRepository.resolveRouteCode(itemCode, options, rules)`:

- Loads all `route_resolution_rules` for the items in the request (one query).
- Each rule has tri-state predicates `(isPremium, hasRepair)` where `null` is wildcard.
- Picks the highest `priority` rule that matches; returns `null` if none.
- For each order item with a non-null resolved route, calls `RouteEngineService.createPlan` in-line — the processing plan exists by the time `POST /orders` returns.

Rule data: seeded in `prisma/seed.ts:seedRouteResolutionRules` (22 rows). Adding a new item type or route → insert rows there, no code change.

## Endpoints

| Method | Path | Guard | Use case |
|---|---|---|---|
| `GET` | `/catalog/items` | none | `GetCatalogItemsUseCase` |
| `GET` | `/catalog/items/:itemCode` | none | `GetCatalogItemUseCase` |
| `POST` | `/pricing/estimate` | none | `EstimatePricingUseCase` |
| `POST` | `/orders` | Customer | `CreateOrderUseCase` |

## Order creation side effects

For each item in the request:
1. INSERT `order_items` + `order_item_options` + `order_item_inputs` + `order_item_photos`.
2. INSERT `order_item_price_snapshots` (per option) — locks prices at order time.
3. If `resolveRouteCode` returned non-null → `RouteEngineService.createPlan` (creates `item_processing_plans` + `item_processing_states` + 2 `item_process_events` + audit log).

## Invariants

- BASE billing is NOT created here. That happens at tag-item time (see [wash-factory](../wash-factory/README.md)).
- `OrderItem.estimatedMinAmount` snapshots the calculated min at order creation.
- `OrderItem.finalAmount` is never written by this domain. Reserved.
- `OrderItem.estimatedMinAmount` is **mutated later** by `ApproveRouteChangeUseCase` (`+= additionalCost`) as a running total for wash-web's route-change form math. Anyone reading this field must treat it as "current cumulative estimate", not "BASE billed amount".

## When you change this domain

- New item type → update `prisma/seed.ts` (catalog) + `route_resolution_rules` seed + [docs/catalog-pricing/laundry-items.md](./laundry-items.md).
- Change `resolveRouteCode` matching logic → only edit `prisma-catalog.repository.ts:resolveRouteCode`. Adding new dimensions (e.g. `isExpedited`) requires the rule predicate set + schema columns to expand together.
- Change Order creation flow → re-run the golden path test (`test/e2e/golden-path.e2e-spec.ts`) and confirm `RouteEngineService.createPlan` is still called for each item whose route resolves.

## Reference

[laundry-items.md](./laundry-items.md) — full Korean catalog used by `prisma/seed.ts`. Source of truth for product data, not for engineering rules.
