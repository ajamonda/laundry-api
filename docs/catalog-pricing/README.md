# Catalog / Pricing / Orders

This domain owns the catalog tree, server-side option validation, price
calculation, and order creation. The `catalog` module covers all three in
`src/modules/catalog/` (catalog + pricing + orders).

## Goal

- Catalog (item types, option groups, nested options, prices, text inputs,
  photo flag, washing-notice options) lives in the DB.
- Server validates submitted option combinations and computes estimated
  totals. Clients are never trusted to compute authoritative prices.
- Orders store catalog snapshots so later catalog changes never mutate
  existing orders.

## Conventions

- API and DB codes use English `snake_case`.
- Display names, option names, washing notices use Korean.
- Prices are KRW integers.

## Price Types (`CatalogPriceType`)

- `FIXED` — single amount.
- `RANGE` — `minAmount`/`maxAmount`; estimates return min/max bounds.
- `UNIT` — base amount up to `baseQuantity` + `extraUnitAmount` per
  `extraUnitQuantity` (e.g. quick-laundry natural detergent).
- `MATRIX` — combination-driven (tent material × size band) — encoded via
  parent/child options.
- `NONE` — non-priced inputs/options.

When any selected option has `RANGE` pricing, the estimate response carries
`estimated_min_amount` + `estimated_max_amount`. Final amounts are filled in
later (`OrderItem.finalAmount`) by factory operations.

## Catalog ↔ Processing Route Link

Each order item is matched to a processing route on creation. The catalog
repository's `resolveRouteCode(itemCode, options)` picks the route by
combining the item code with the selected `cleaning_method` and any `repair`
options. For example:

| item | options | route |
|---|---|---|
| `shirt` | `regular_wash` | `GENERAL_CLOTHES_CLEANING` |
| `shirt` | `premium_wash` | `PREMIUM_CLEANING` |
| `shirt` | `regular_wash` + repair | `REPAIR_AND_CLEANING` |
| `shirt` | `premium_wash` + repair | `REPAIR_AND_PREMIUM_CLEANING` |
| `sneakers` | `regular_wash` | `STANDARD_SHOES_CLEANING` |
| `sneakers` | `premium_wash` + repair | `REPAIR_AND_PREMIUM_SHOES_CLEANING` |
| `ugg_boots` | `regular_wash` + repair | `OUTSOURCED_CLEANING` |
| `tent` | any | `OUTSOURCED_ONLY_CLEANING` |
| `quick_laundry` | any | `QUICK_LAUNDRY` |

`catalog_items.processing_route_code` is the fallback default per item. When
`resolveRouteCode` returns a code, `CreateOrderUseCase` immediately calls
`RouteEngineService.createPlan` so the processing plan exists from the
moment the order is created. If resolution returns `null`, no plan is
created and a wash operator must call `/wash/tags/:tag/assign-route` after
tagging.

## API

| Method | Path | Guard | Notes |
|---|---|---|---|
| `GET` | `/catalog/items` | none | List catalog items + summary metadata. |
| `GET` | `/catalog/items/:itemCode` | none | One item with option groups, nested options, prices, inputs. |
| `POST` | `/pricing/estimate` | none | Validates a client-side cart, returns item-level + order-level estimated totals. |
| `POST` | `/orders` | Customer | Creates `LaundryOrder` + `OrderItem` + option/input/photo + price snapshot rows. Also auto-creates an `ItemProcessingPlan` for each item whose route can be resolved. |

> Server-side cart drafts (`POST /order-drafts` etc.) are deliberately not
> built in the MVP; the frontend keeps the cart locally and posts the whole
> payload to `/orders`.

## Catalog Reference

Full Korean catalog (items, options, prices) lives in
[`laundry-items.md`](./laundry-items.md). It is the source for `prisma/seed.ts`.

## Test Notes

- Seed creates all MVP catalog entries; option combos validate correctly.
- Estimate returns min/max when range-priced options are selected.
- Order creation persists selected option codes, text inputs, photo refs, and
  per-option price snapshots, and auto-attaches a processing plan when a
  route can be resolved.
