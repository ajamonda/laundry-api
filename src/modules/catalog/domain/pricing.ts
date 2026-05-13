import { CatalogPrice } from './catalog.types';

/**
 * Pure pricing math. Given a CatalogPrice row and an optional quantity,
 * returns the (min, max) estimated amount in KRW.
 *
 * Branching by `priceType`:
 *
 *   - FIXED, MATRIX → flat amount (max=min)
 *   - RANGE         → (minAmount, maxAmount). maxAmount falls back to
 *                     minAmount when null (so a one-sided "from X" reads
 *                     as a point estimate, not a 0-max).
 *   - UNIT          → baseAmount + ceil(extraQuantity / extraUnitQuantity)
 *                     × extraUnitAmount. extraQuantity is clamped at 0
 *                     (under-base quantities don't refund).
 *   - NONE          → (0, 0) — the row signals "price not yet defined".
 *
 * No I/O, no exceptions thrown. Behaviour must match the legacy
 * `PrismaCatalogRepository.calculatePrice` exactly — this is a pure
 * extraction, not a redesign.
 */
export function calculatePrice(
  price: CatalogPrice,
  quantity?: number,
): { min: number; max: number } {
  if (price.priceType === 'FIXED' || price.priceType === 'MATRIX') {
    const amount = price.amount ?? 0;
    return { min: amount, max: amount };
  }

  if (price.priceType === 'RANGE') {
    return {
      min: price.minAmount ?? 0,
      max: price.maxAmount ?? price.minAmount ?? 0,
    };
  }

  if (price.priceType === 'UNIT') {
    const baseAmount = price.baseAmount ?? price.amount ?? 0;
    const baseQuantity = price.baseQuantity ? Number(price.baseQuantity) : 0;
    const extraUnitQuantity = price.extraUnitQuantity
      ? Number(price.extraUnitQuantity)
      : 0;
    const extraUnitAmount = price.extraUnitAmount ?? 0;
    const selectedQuantity = quantity ?? baseQuantity;
    const extraQuantity = Math.max(selectedQuantity - baseQuantity, 0);
    const extraUnits =
      extraUnitQuantity > 0 ? Math.ceil(extraQuantity / extraUnitQuantity) : 0;
    const amount = baseAmount + extraUnits * extraUnitAmount;
    return { min: amount, max: amount };
  }

  return { min: 0, max: 0 };
}
