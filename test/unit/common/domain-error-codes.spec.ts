import { DomainError } from '../../../src/common/errors/domain-error';
import * as billingErrors from '../../../src/modules/billing/domain/billing.errors';
import * as deliveryErrors from '../../../src/modules/delivery/domain/delivery.errors';
import * as exceptionErrors from '../../../src/modules/exception/domain/exception.errors';
import * as routeEngineErrors from '../../../src/modules/processing-route/domain/route-engine.errors';
import * as washErrors from '../../../src/modules/wash/domain/wash.errors';

/**
 * Contract lock for `DomainError.code` across all domains.
 *
 * The `code` field is part of the public API (response body) and tests +
 * clients branch on it. This file enforces shape invariants so a future
 * AI / refactor cannot silently rename a code, drop the domain prefix, or
 * introduce a duplicate.
 *
 * Allowed prefixes are listed in `ALLOWED_PREFIXES`. If you add a new
 * domain that throws DomainErrors, register its prefix here.
 */

const ALLOWED_PREFIXES = ['WASH', 'BILLING', 'EXCEPTION', 'DELIVERY', 'ROUTE'] as const;
const SCREAMING_SNAKE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;

const ERROR_MODULES: Array<{ name: string; module: Record<string, unknown> }> = [
  { name: 'wash', module: washErrors },
  { name: 'billing', module: billingErrors },
  { name: 'exception', module: exceptionErrors },
  { name: 'delivery', module: deliveryErrors },
  { name: 'processing-route', module: routeEngineErrors },
];

function collectErrorClasses(): Array<{ moduleName: string; ctor: new (...args: any[]) => DomainError }> {
  const out: Array<{ moduleName: string; ctor: new (...args: any[]) => DomainError }> = [];
  for (const { name, module } of ERROR_MODULES) {
    for (const exported of Object.values(module)) {
      if (typeof exported !== 'function') continue;
      // Heuristic: it's a class whose prototype is (a subclass of) DomainError.
      const proto = (exported as { prototype?: unknown }).prototype;
      if (!proto) continue;
      if (proto instanceof DomainError || Object.getPrototypeOf(proto) === DomainError.prototype) {
        out.push({ moduleName: name, ctor: exported as new (...args: any[]) => DomainError });
      }
    }
  }
  return out;
}

/**
 * Construct an instance of each error class with synthetic args. We use a
 * Proxy to satisfy any string / number constructor parameters uniformly —
 * we never care about the message, only `.code`.
 */
function instantiate(ctor: new (...args: any[]) => DomainError): DomainError {
  const stubArg: any = new Proxy(
    { toString: () => 'stub', valueOf: () => 0 },
    {
      get(target, prop) {
        if (prop in target) return (target as any)[prop];
        return 'stub';
      },
    },
  );
  // Try increasing arities until construction succeeds.
  for (let arity = 0; arity <= 4; arity++) {
    try {
      return new ctor(...Array(arity).fill(stubArg));
    } catch {
      // try next arity
    }
  }
  throw new Error(`could not instantiate ${ctor.name}`);
}

describe('DomainError code contract', () => {
  const classes = collectErrorClasses();

  it('discovers at least one error class per domain (sanity)', () => {
    const perDomain = new Map<string, number>();
    for (const { moduleName } of classes) {
      perDomain.set(moduleName, (perDomain.get(moduleName) ?? 0) + 1);
    }
    for (const { name } of ERROR_MODULES) {
      expect(perDomain.get(name) ?? 0).toBeGreaterThan(0);
    }
  });

  it.each(
    collectErrorClasses().map(({ moduleName, ctor }) => [moduleName, ctor.name, ctor] as const),
  )('%s/%s declares a code in SCREAMING_SNAKE_CASE with an allowed prefix', (_module, _name, ctor) => {
    const instance = instantiate(ctor);
    expect(typeof instance.code).toBe('string');
    expect(instance.code).toMatch(SCREAMING_SNAKE);
    const prefix = instance.code.split('_')[0];
    expect(ALLOWED_PREFIXES).toContain(prefix as (typeof ALLOWED_PREFIXES)[number]);
  });

  it('codes are globally unique (no two error classes share the same code)', () => {
    const seen = new Map<string, string>();
    const duplicates: Array<{ code: string; first: string; second: string }> = [];
    for (const { ctor } of classes) {
      const instance = instantiate(ctor);
      const prior = seen.get(instance.code);
      if (prior) {
        duplicates.push({ code: instance.code, first: prior, second: ctor.name });
      } else {
        seen.set(instance.code, ctor.name);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('every DomainError subclass produces an HttpException with a status (≥ 400)', () => {
    for (const { ctor } of classes) {
      const instance = instantiate(ctor);
      const status = instance.getStatus();
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(600);
    }
  });
});
