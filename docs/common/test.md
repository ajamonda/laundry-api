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
| Spec conformance | New invariant in a README | `test/e2e/<area>.e2e-spec.ts` | one `it()` per README sentence |
| Pure-domain unit | Branchy pure logic (pricing, state machine) | `test/unit/*.spec.ts` (none yet) | direct function call, no DB / Nest |

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
2. `npm run test:e2e` — passes.

By scope:

| Change | Also do |
|---|---|
| New DB schema | (a) migration applied, (b) seed updated, (c) [test/utils/db.ts](../../test/utils/db.ts) `DELETE_ORDER` reviewed for FK order, (d) ≥1 test asserts the new column/table |
| New use case with read-then-write | Add race test with `Promise.all` + count assertion |
| New side effect that must run exactly once | Encode via DB UNIQUE + repository P2002 catch; add idempotency test |
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
