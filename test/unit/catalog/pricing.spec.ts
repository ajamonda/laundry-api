import { calculatePrice } from '../../../src/modules/catalog/domain/pricing';
import { CatalogPrice } from '../../../src/modules/catalog/domain/catalog.types';

const base = (overrides: Partial<CatalogPrice> = {}): CatalogPrice => ({
  id: 'p1',
  priceType: 'FIXED',
  currency: 'KRW',
  amount: null,
  minAmount: null,
  maxAmount: null,
  baseAmount: null,
  baseQuantity: null,
  baseUnit: null,
  extraUnitQuantity: null,
  extraUnitAmount: null,
  ...overrides,
});

describe('calculatePrice', () => {
  describe('FIXED', () => {
    it('returns (amount, amount)', () => {
      expect(calculatePrice(base({ priceType: 'FIXED', amount: 8000 }))).toEqual({
        min: 8000,
        max: 8000,
      });
    });

    it('treats null amount as 0 (defensive — not expected from seed)', () => {
      expect(calculatePrice(base({ priceType: 'FIXED', amount: null }))).toEqual({
        min: 0,
        max: 0,
      });
    });
  });

  describe('MATRIX', () => {
    it('behaves like FIXED — flat amount', () => {
      expect(calculatePrice(base({ priceType: 'MATRIX', amount: 12000 }))).toEqual({
        min: 12000,
        max: 12000,
      });
    });
  });

  describe('RANGE', () => {
    it('returns (minAmount, maxAmount) when both set', () => {
      expect(
        calculatePrice(
          base({ priceType: 'RANGE', minAmount: 5000, maxAmount: 9000 }),
        ),
      ).toEqual({ min: 5000, max: 9000 });
    });

    it('falls back maxAmount to minAmount when max is null', () => {
      expect(
        calculatePrice(base({ priceType: 'RANGE', minAmount: 7000, maxAmount: null })),
      ).toEqual({ min: 7000, max: 7000 });
    });

    it('returns (0,0) when both ends are null', () => {
      expect(
        calculatePrice(base({ priceType: 'RANGE', minAmount: null, maxAmount: null })),
      ).toEqual({ min: 0, max: 0 });
    });
  });

  describe('UNIT', () => {
    it('at base quantity → baseAmount only, no extras', () => {
      const price = base({
        priceType: 'UNIT',
        baseAmount: 10000,
        baseQuantity: '1',
        extraUnitQuantity: '1',
        extraUnitAmount: 3000,
      });
      expect(calculatePrice(price, 1)).toEqual({ min: 10000, max: 10000 });
    });

    it('above base quantity → ceil((q - base) / extraUnitQuantity) × extraUnitAmount', () => {
      // baseQuantity=1, extraUnitQuantity=1, qty=3 → 2 extra units × 3000 = 6000
      const price = base({
        priceType: 'UNIT',
        baseAmount: 10000,
        baseQuantity: '1',
        extraUnitQuantity: '1',
        extraUnitAmount: 3000,
      });
      expect(calculatePrice(price, 3)).toEqual({ min: 16000, max: 16000 });
    });

    it('ceils a fractional extra block (e.g. 0.3 extra of a 1-unit block = 1 unit charge)', () => {
      // baseQuantity=1, extraUnitQuantity=1, qty=1.3 → ceil(0.3/1) = 1 unit × 3000 = 3000
      const price = base({
        priceType: 'UNIT',
        baseAmount: 10000,
        baseQuantity: '1',
        extraUnitQuantity: '1',
        extraUnitAmount: 3000,
      });
      expect(calculatePrice(price, 1.3)).toEqual({ min: 13000, max: 13000 });
    });

    it('below base quantity does NOT refund (clamped at 0 extra units)', () => {
      const price = base({
        priceType: 'UNIT',
        baseAmount: 10000,
        baseQuantity: '2',
        extraUnitQuantity: '1',
        extraUnitAmount: 3000,
      });
      expect(calculatePrice(price, 1)).toEqual({ min: 10000, max: 10000 });
    });

    it('omitted quantity defaults to baseQuantity (no extras charged)', () => {
      const price = base({
        priceType: 'UNIT',
        baseAmount: 10000,
        baseQuantity: '2',
        extraUnitQuantity: '1',
        extraUnitAmount: 3000,
      });
      expect(calculatePrice(price)).toEqual({ min: 10000, max: 10000 });
    });

    it('zero extraUnitQuantity disables the extra-charge math (no division by zero)', () => {
      const price = base({
        priceType: 'UNIT',
        baseAmount: 10000,
        baseQuantity: '1',
        extraUnitQuantity: '0',
        extraUnitAmount: 3000,
      });
      expect(calculatePrice(price, 5)).toEqual({ min: 10000, max: 10000 });
    });

    it('falls back baseAmount to amount when baseAmount is null', () => {
      const price = base({
        priceType: 'UNIT',
        amount: 9000,
        baseAmount: null,
        baseQuantity: '1',
        extraUnitQuantity: '1',
        extraUnitAmount: 2000,
      });
      expect(calculatePrice(price, 2)).toEqual({ min: 11000, max: 11000 });
    });
  });

  describe('NONE', () => {
    it('returns (0, 0)', () => {
      expect(calculatePrice(base({ priceType: 'NONE' }))).toEqual({ min: 0, max: 0 });
    });
  });
});
