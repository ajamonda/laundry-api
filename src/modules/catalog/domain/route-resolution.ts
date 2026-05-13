import { EstimateSelectedOption } from './catalog.types';

/**
 * One row of `route_resolution_rules`. `null` on `isPremium` / `hasRepair`
 * means "wildcard — matches both true and false".
 */
export type RouteRule = {
  itemCode: string;
  isPremium: boolean | null;
  hasRepair: boolean | null;
  routeCode: string;
  priority: number;
};

/**
 * Data-driven route resolution.
 *
 * Picks a `routeCode` for an item given its selected options and the
 * full rule table (loaded once per request from `route_resolution_rules`).
 *
 *   1. Derive the two predicates the rule table understands:
 *        - `isPremium` ← any option in group `cleaning_method`
 *          with optionCode `premium_wash`
 *        - `hasRepair` ← any option in group `repair` (any optionCode)
 *      The seed today only branches on these two; new predicates require
 *      both a schema column on `route_resolution_rules` AND a derive step
 *      here.
 *   2. Filter rules: itemCode must match exactly; each tri-state predicate
 *      matches when the rule column is `null` (wildcard) or equals the
 *      derived value.
 *   3. Sort by `priority` DESC and return the first match's routeCode,
 *      or null if no rule matched.
 *
 * Pure function: no I/O. `rules` is read-only.
 */
export function resolveRouteCode(
  itemCode: string,
  options: EstimateSelectedOption[],
  rules: RouteRule[],
): string | null {
  const isPremium = options.some(
    (o) => o.groupCode === 'cleaning_method' && o.optionCode === 'premium_wash',
  );
  const hasRepair = options.some((o) => o.groupCode === 'repair');

  const candidates = rules
    .filter((r) => r.itemCode === itemCode)
    .filter((r) => r.isPremium === null || r.isPremium === isPremium)
    .filter((r) => r.hasRepair === null || r.hasRepair === hasRepair)
    .sort((a, b) => b.priority - a.priority);

  return candidates[0]?.routeCode ?? null;
}
