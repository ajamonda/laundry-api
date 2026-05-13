# Testing

## Stack
- Jest + ts-jest + supertest.
- Real PostgreSQL `laundry_test` DB. No SQLite, no Docker.
- Single-node Nest app via `createTestApp()` in [test/utils/app.ts](../../test/utils/app.ts).

## Lifecycle
| Hook | Action |
|---|---|
| `globalSetup` ([test/global-setup.ts](../../test/global-setup.ts)) | `prisma migrate deploy` + `prisma db seed` against `laundry_test` |
| `setupFiles` ([test/load-env.ts](../../test/load-env.ts)) | load `.env.test`; assert `DATABASE_URL` contains `_test` |
| `beforeAll` (per spec file) | `createTestApp()` |
| `beforeEach` | `resetDb()` — DELETE volatile tables in dependency order ([test/utils/db.ts](../../test/utils/db.ts)) |
| `afterAll` | `app.close()` + `disconnectTestPrisma()` |

`resetDb` preserves seeded rows (catalog, processing routes, exception flow templates, pickup vehicles, pickup bags, delivery vehicles, order request options, route resolution rules).

## Test categories — what each is for

| Category | Trigger | Location | Pattern |
|---|---|---|---|
| Smoke | Harness or env change | `test/smoke.e2e-spec.ts` | DB connect + seed counts |
| Golden path | Add domain / change spine | `test/e2e/golden-path.e2e-spec.ts` | full HTTP flow, end-state DB assertion |
| Race / concurrency | New read-then-write, new DB lock / CAS / UNIQUE | `test/e2e/<area>-races.e2e-spec.ts` | `Promise.all` + DB count assertion |
| Atomicity regression | New `prisma.$transaction` boundary in a use case | `test/e2e/<area>-atomicity.e2e-spec.ts` | force a mid-tx throw; assert no partial DB state |
| Spec conformance | New invariant in a README | `test/e2e/<area>.e2e-spec.ts` | one `it()` per README sentence |
| Pure-domain unit | Branchy pure logic (pricing, route resolution, next-step picker, error classifier) | `test/unit/**/*.spec.ts` | direct function call, no DB / Nest |
| Contract lock | New `DomainError` subclass / new error `code` | `test/unit/common/domain-error-codes.spec.ts` (parametric) | discover-and-assert across `*.errors.ts` |

## Pure-domain unit tests — scope and limits

Unit tests live in `test/unit/<area>/<name>.spec.ts` and run via `npm run test:unit` (config: [`test/jest-unit.json`](../../test/jest-unit.json)). No DB, no Nest, no supertest — just direct function calls.

**This category is intentionally narrow.** It exists for pure functions where E2E coverage cannot exhaustively exercise the branches. The current sanctioned set:

| Target | File | Why it's a unit test, not E2E |
|---|---|---|
| `calculatePrice` | `src/modules/catalog/domain/pricing.ts` | 5 price types × ceil edges × null fallbacks — combinatorial, trivial to test pure |
| `resolveRouteCode` | `src/modules/catalog/domain/route-resolution.ts` | Tri-state predicate × priority sort — exhaustive matrix is unreasonable via HTTP |
| `pickNextStep` + `findNextTemplateStep` | `src/modules/processing-route/domain/next-step.ts` | The override-vs-route winner pick and template peek — testing every combo via E2E requires fabricating override stacks |
| `classifyException` | `src/common/errors/classify-exception.ts` | 5 mapping branches; protects the masking-on-leak contract from regressing |

**HARD RULE — do not add unit tests outside this scope.** Specifically:

- **No mocked-Prisma "unit tests" for repositories.** They test the mock, not the SQL. Use E2E.
- **No mocked-repo "unit tests" for use cases.** A use case is orchestration; mocking its inputs tests the orchestration shape, not the behaviour. Use E2E + the golden path / race specs.
- **No mocked-service "unit tests" for controllers, guards, gateways.** Framework wiring is the framework's job.
- **No unit tests for trivial branchless code** (`if (status !== 'X') throw ...` style guards). Status precondition checks are already covered by E2E spec-conformance tests.

If you find yourself reaching for `jest.mock(...)` or `jest.fn()` inside `test/unit/`, stop — you are about to write a brittle harness that will rot. Either:
  (a) extract the branchy pure logic into a function with no I/O and test that (the existing pattern), or
  (b) add an E2E spec instead.

When adding a new pure target: the function MUST live under `<domain>/domain/` and have zero dependencies on Prisma, Nest, HTTP, or the filesystem. If it can't be written that way, it doesn't belong in `test/unit/`.

## Shared e2e helpers

Customer / pickup / wash flow setup is centralised in [`test/utils/flows.ts`](../../test/utils/flows.ts):

| Helper | Purpose |
|---|---|
| `login(http, path, body)` | dev-login on any auth endpoint, returns JWT |
| `authedCustomer(http)` | customer-1 dev-login + profile patch; returns token |
| `createOrder(http, token, n)` | n × `shirt` items with regular_wash; returns orderId |
| `pickupTo(http, orderId, token)` | full pickup → IN_HOUSE; returns itemIds |
| `tagAll(http, itemIds, token)` | tags items as `TAG-001`, `TAG-002`, ...; returns tags |
| `scanUntilOneScanLeft(http, tag, token)` | walks scan-step until one scan remains before plan completion |

New e2e specs MUST import from `test/utils/flows.ts` instead of re-inlining setup. Re-inlining duplicates ~50 lines per file and the shared helpers stay in sync with the API. Existing `billing-races.e2e-spec.ts` predates the extraction and keeps its inline copies — do not "fix" it; touch the new specs only.

## Atomicity regression tests (transaction-boundary contracts)

When a use case is refactored to open a `prisma.$transaction` and thread `tx` into multiple sub-calls (the wash-domain pattern — see [docs/wash-factory/README.md](../wash-factory/README.md#transaction-model-hard-rules--do-not-regress)), add an atomicity regression test in `test/e2e/<area>-atomicity.e2e-spec.ts`.

The test MUST:

1. Set up state so a known sub-call throws mid-transaction (e.g. a P2002 by reusing a UNIQUE value, or a `BadRequestException` by passing a bogus route code).
2. Capture relevant DB counts BEFORE the failing request (filtered narrowly — see foot-gun below).
3. Issue the request and assert the documented status + `body.code` of the failure.
4. Re-query the same DB counts AFTER and assert **zero** new rows / no status flip / no audit log of the protected action.

**Foot-gun**: when comparing "audit log count before vs after", filter on `actionType` to the SPECIFIC action you care about (`ITEM_TAGGED`, `STEP_COMPLETED`, etc.). Unfiltered counts pick up unrelated audit rows (e.g. `PLAN_CREATED` from order creation) and produce a misleading green test.

## Required patterns

### CAS race assertion
```ts
const [r1, r2] = await Promise.all([
  http.post('/...').set(auth).send(body),
  http.post('/...').set(auth).send(body),
]);
expect([r1.status, r2.status].sort()).toEqual([201, 409]);
const rows = await prisma.<model>.findMany({ where: {...} });
expect(rows).toHaveLength(1);
```

### Deadlock-free assertion
```ts
const results = await Promise.all(triggers.map(t => http.post(`/...${t}`).set(auth)));
for (const r of results) expect(r.status).toBe(201);
```

### DB UNIQUE idempotency
```ts
await action({ sourceId: 'x' });
await action({ sourceId: 'x' });
const rows = await prisma.<model>.findMany({ where: { sourceId: 'x' } });
expect(rows).toHaveLength(1);
```

### Socket push verification (indirect)
Do not spy on the gateway. Inspect `notifiedAt` in the DB. The repository sets it in the same transaction as the emit, so `notifiedAt = NOW` ⟺ "push happened".

### Error assertion
Assert on `res.body.code` (the stable contract from `DomainError`), not on `res.body.message`. Status code alone is too coarse — multiple errors share 409. The shape is always `{ code: string, message: string, statusCode: number }` (emitted by [`AllExceptionsFilter`](../../src/common/errors/all-exceptions.filter.ts), which is wired into both `main.ts` AND `test/utils/app.ts` — do not "fix" the test app to skip it).
```ts
expect(res.status).toBe(409);
expect(res.body.code).toBe('WASH_ITEM_NOT_TAGGABLE');
```
Do not match on `body.message` — messages are human-facing copy and can change without contract impact.

**Inline-throw transition case**: if the use case still throws a raw `ConflictException` / `NotFoundException` / etc. (one of the pre-DomainError sites listed in coding-style.md "Error handling rules"), `body.code` is `HTTP_<STATUS>` (e.g. `HTTP_409`) until that site is migrated. The **preferred** path is to migrate the inline throw to a `DomainError` subclass in the same change (the relevant `*.errors.ts` usually already has a matching class — reuse before creating new) and assert the strict code. Only if migration is genuinely out of scope, fall back to:
```ts
expect(['HTTP_409', '<EXPECTED_DOMAIN_CODE>']).toContain(res.body.code);
```
with a TODO comment naming the file/lines to migrate. Do not leave such loosened assertions in main without a follow-up plan — they erode the contract's value.

## What never to test

| Don't test | Why |
|---|---|
| Controller routing | Nest router handles it |
| DTO validation | `class-validator` handles it |
| Repository-mock-backed use cases | E2E covers it; mocks rot |
| Prisma query mechanics | Prisma handles it |
| Static catalog read endpoints | Asserts seed against seed |

## Post-change checklist

Run in order:

1. `npm run typecheck` — passes.
2. `npm run test:unit` — passes.
3. `npm run test:e2e` — passes.

By scope:

| Change | Also do |
|---|---|
| New DB schema | (a) migration applied, (b) seed updated, (c) [test/utils/db.ts](../../test/utils/db.ts) `DELETE_ORDER` reviewed for FK order, (d) ≥1 test asserts the new column/table |
| New use case with read-then-write | Add race test with `Promise.all` + count assertion |
| New `prisma.$transaction` boundary in a use case | Add atomicity regression test (force mid-tx throw, assert no partial DB state) |
| New side effect that must run exactly once | Encode via DB UNIQUE + repository `withIdempotency(insert, fetchExisting)` wrapper; add idempotency test |
| New `DomainError` subclass | Add a test that asserts `body.code === '<NEW_CODE>'` from the relevant endpoint — locks the contract |
| New cross-domain wiring | Update both domain READMEs and the exports table in [docs/README.md](../README.md) |
| New WebSocket event | Verify with DB marker, not gateway spy; grep `laundry-user-web/src/useRealtimeRequests.ts` for client expectation |
| Race fix / new lock | Confirm the race-reproducing test fails on pre-fix code, passes after |
| Bug fix | Add a regression test that fails without the fix |
| Dead code removal | `grep -r <symbol>` confirms 0 callers before deletion |

## Anti-patterns (do not)

| Don't | Because | Instead |
|---|---|---|
| `TRUNCATE ... CASCADE` mixed with seeded tables | PG CASCADE follows FK graph, wipes seeded `pickup_bags` via `pickup_runs` FK | `DELETE FROM` in dependency order |
| Hard `expect(201)` between scan-step calls | Exception flow steps legitimately return 409 mid-loop | Loop on DB state (`currentOverride.stepType`), exit on terminal state |
| `expect(...).toBeTruthy()` for IDs | `0` and `""` are falsy; non-empty string passes | `expect(rows).toHaveLength(N)` or exact value |
| Counting all `payment_events` for "1 resolution" | `BILLING_CREATED` event is also a row | Filter by `eventType: { in: ['PAYMENT_SUCCEED', 'PAYMENT_FAILED'] }` |
| Tests that hard-fail on `WAIT_CUSTOMER_DECISION` scan | Seed flow has two consecutive `WAIT_*` steps in `REPAIR_APPROVAL_FLOW` | Use route-change as SUPPLEMENT origin in tests, or DB-loop on stepType |
| Spying on socket gateway | Fragile + couples test to wiring | Read `notifiedAt` from DB |
| Adding `setTimeout` to "make race tests reliable" | Couples production code to test timing | Trust DB lock / CAS / UNIQUE; race-test passes do not require timing |

## Debugging

| Need | Command / snippet |
|---|---|
| Dump rows on failure | `console.dir(await prisma.<model>.findMany({where}), { depth: null });` |
| Show HTTP error body | `if (res.status !== 201) console.log(res.status, res.body);` |
| Single file | `npm run test:e2e -- --testPathPattern=billing-races` |
| Single test | `npm run test:e2e -- --testNamePattern="claims every BASE"` |
| Inspect Prisma SQL | append `&log=query` to test `DATABASE_URL` |

## New file template

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../utils/app';
import { disconnectTestPrisma, getTestPrisma, resetDb } from '../utils/db';

describe('<domain>: <feature>', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => { app = await createTestApp(); http = request(app.getHttpServer()); });
  afterAll(async () => { await app.close(); await disconnectTestPrisma(); });
  beforeEach(async () => { await resetDb(); });

  it('<active-verb spec statement>', async () => {
    // setup → action → assert via HTTP code + DB state
  });
});
```
