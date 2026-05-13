import {
  resolveRouteCode,
  RouteRule,
} from '../../../src/modules/catalog/domain/route-resolution';

const rule = (overrides: Partial<RouteRule>): RouteRule => ({
  itemCode: 'SHIRT',
  isPremium: null,
  hasRepair: null,
  routeCode: 'STANDARD',
  priority: 0,
  ...overrides,
});

describe('resolveRouteCode', () => {
  it('returns null when no rule matches the itemCode', () => {
    const rules = [rule({ itemCode: 'COAT', routeCode: 'COAT_STD' })];
    expect(resolveRouteCode('SHIRT', [], rules)).toBeNull();
  });

  it('returns null when no rule exists at all', () => {
    expect(resolveRouteCode('SHIRT', [], [])).toBeNull();
  });

  it('picks the wildcard rule when no predicate-specific rule exists', () => {
    const rules = [rule({ routeCode: 'SHIRT_STD', priority: 0 })];
    expect(resolveRouteCode('SHIRT', [], rules)).toBe('SHIRT_STD');
  });

  it('picks the higher-priority rule among ties on predicates', () => {
    const rules = [
      rule({ routeCode: 'LOW', priority: 1 }),
      rule({ routeCode: 'HIGH', priority: 10 }),
      rule({ routeCode: 'MID', priority: 5 }),
    ];
    expect(resolveRouteCode('SHIRT', [], rules)).toBe('HIGH');
  });

  it('matches isPremium=true when option cleaning_method=premium_wash is selected', () => {
    const rules = [
      rule({ isPremium: false, routeCode: 'STD', priority: 1 }),
      rule({ isPremium: true, routeCode: 'PREMIUM', priority: 1 }),
    ];
    const opts = [{ groupCode: 'cleaning_method', optionCode: 'premium_wash' }];
    expect(resolveRouteCode('SHIRT', opts, rules)).toBe('PREMIUM');
  });

  it('matches isPremium=false when option cleaning_method=standard_wash (anything but premium)', () => {
    const rules = [
      rule({ isPremium: false, routeCode: 'STD', priority: 1 }),
      rule({ isPremium: true, routeCode: 'PREMIUM', priority: 1 }),
    ];
    const opts = [{ groupCode: 'cleaning_method', optionCode: 'standard_wash' }];
    expect(resolveRouteCode('SHIRT', opts, rules)).toBe('STD');
  });

  it('matches hasRepair=true when ANY option in the repair group is selected', () => {
    const rules = [
      rule({ hasRepair: false, routeCode: 'NO_REPAIR', priority: 1 }),
      rule({ hasRepair: true, routeCode: 'WITH_REPAIR', priority: 1 }),
    ];
    const opts = [{ groupCode: 'repair', optionCode: 'patch_hole' }];
    expect(resolveRouteCode('SHIRT', opts, rules)).toBe('WITH_REPAIR');
  });

  it('a wildcard rule (null predicate) matches both predicate values; specific rule wins on priority', () => {
    const rules = [
      rule({ isPremium: null, routeCode: 'ANY', priority: 1 }),
      rule({ isPremium: true, routeCode: 'PREMIUM', priority: 5 }),
    ];
    const premiumOpts = [{ groupCode: 'cleaning_method', optionCode: 'premium_wash' }];
    expect(resolveRouteCode('SHIRT', premiumOpts, rules)).toBe('PREMIUM');
    expect(resolveRouteCode('SHIRT', [], rules)).toBe('ANY');
  });

  it('combines isPremium AND hasRepair predicates (both must match)', () => {
    const rules = [
      rule({ isPremium: true, hasRepair: false, routeCode: 'PREMIUM_ONLY', priority: 1 }),
      rule({ isPremium: true, hasRepair: true, routeCode: 'PREMIUM_REPAIR', priority: 1 }),
    ];
    const opts = [
      { groupCode: 'cleaning_method', optionCode: 'premium_wash' },
      { groupCode: 'repair', optionCode: 'patch_hole' },
    ];
    expect(resolveRouteCode('SHIRT', opts, rules)).toBe('PREMIUM_REPAIR');
  });

  it('filters out rules whose itemCode differs even when predicates match', () => {
    const rules = [
      rule({ itemCode: 'COAT', isPremium: true, routeCode: 'COAT_PREMIUM', priority: 10 }),
      rule({ itemCode: 'SHIRT', isPremium: true, routeCode: 'SHIRT_PREMIUM', priority: 1 }),
    ];
    const opts = [{ groupCode: 'cleaning_method', optionCode: 'premium_wash' }];
    expect(resolveRouteCode('SHIRT', opts, rules)).toBe('SHIRT_PREMIUM');
  });
});
