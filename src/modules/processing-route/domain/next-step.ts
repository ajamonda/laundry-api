/**
 * Pure decision helpers for `RouteEngineService.findNextStep`. Extracted so
 * the branchy "pick the next step" logic is unit-testable without a DB.
 *
 * The DB-heavy outer function in route-engine.service.ts is responsible for:
 *   - Loading the active override row + the next route step.
 *   - Loading the override flow template when needed.
 *   - Popping the override stack when a template is exhausted.
 *
 * Once those candidates exist, the *decisions* below are pure data-in /
 * data-out functions.
 */

export type StepCandidate = {
  id: string;
  stepType: string;
  displayName: string;
  sortOrder: number;
};

export type NextStepDecision = {
  step: StepCandidate;
  source: 'ROUTE' | 'OVERRIDE';
};

/**
 * Winner selection between an override candidate and a route candidate.
 *
 *   - Both null  → no next step (plan completion)
 *   - Only one   → that one wins
 *   - Both       → the one with the lower sortOrder wins. Tie defers to
 *                  ROUTE (an OVERRIDE at the SAME sortOrder as a route step
 *                  means we are CURRENTLY on the override and have already
 *                  resolved its successor as `nextRouteStep`).
 *
 * Behaviour must match the legacy inline branch at the bottom of
 * `findNextStep`. Keep parity.
 */
export function pickNextStep(
  overrideCandidate: StepCandidate | null,
  routeCandidate: StepCandidate | null,
): NextStepDecision | null {
  if (!overrideCandidate && !routeCandidate) return null;
  if (!routeCandidate) return { step: overrideCandidate!, source: 'OVERRIDE' };
  if (overrideCandidate && overrideCandidate.sortOrder < routeCandidate.sortOrder) {
    return { step: overrideCandidate, source: 'OVERRIDE' };
  }
  return { step: routeCandidate, source: 'ROUTE' };
}

/**
 * Find the next template step within an exception flow.
 *
 * Given the template's full step list (ordered by offset asc) and the
 * override's `currentOffset`, return the first step with a strictly greater
 * offset, projected into a `StepCandidate` whose sortOrder is the override's
 * `baseStepSortOrder` + the template offset.
 *
 * Returns null when:
 *   - `templateSteps` is empty (no active template found upstream), or
 *   - every step's offset is ≤ currentOffset (template exhausted).
 *
 * Behaviour must match the inline `find((s) => s.offset > currentOffset)`
 * call inside `findNextStep`. Keep parity.
 */
export function findNextTemplateStep(
  templateSteps: { offset: number; stepType: string; displayName: string }[],
  currentOffset: number,
  baseStepSortOrder: number,
  overrideId: string,
): StepCandidate | null {
  const next = templateSteps.find((s) => s.offset > currentOffset) ?? null;
  if (!next) return null;
  return {
    id: overrideId,
    stepType: next.stepType,
    displayName: next.displayName,
    sortOrder: baseStepSortOrder + next.offset,
  };
}
