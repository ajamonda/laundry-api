# Architecture

## Stack
- NestJS 11 + TypeScript 5 (strict, `isolatedModules`).
- Prisma 6 + PostgreSQL. No SQLite substitution anywhere.
- REST over Express. OpenAPI / Swagger served at `GET /docs`.
- socket.io via `@nestjs/platform-socket.io`. Two namespaces: `/billing`, `/exception`.
- JWT via `@nestjs/jwt`. Customer / staff tokens disjoint (see [auth-actor](../auth-actor/README.md)).

## Source layout
```
src/
  main.ts                     # bootstrap, ValidationPipe(whitelist+forbid+transform), IoAdapter, Swagger
  app.module.ts               # imports all domain modules
  common/auth/                # guards, decorators, principals
  database/                   # PrismaModule, PrismaService
  modules/<domain>/
    <domain>.module.ts
    interfaces/http/          # controllers + class-validator DTOs
    interfaces/ws/            # socket gateways (billing, exception only)
    application/use-cases/    # one class per business action
    domain/                   # types, policies, repository ports (interfaces only), errors, exported services
    infrastructure/           # Prisma repositories, external adapters
test/                         # see common/test.md
prisma/                       # schema.prisma, migrations, seed.ts
```

## Runtime invariants

- `ValidationPipe` is global with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. DTOs must declare every accepted field.
- WS adapter is single-node (`IoAdapter`). Horizontal scale requires `@socket.io/redis-adapter`. Not in place.
- `JWT_SECRET` is read from env. Test env uses `.env.test`; never reuse production secret.
- CORS on WS gateways is currently `origin: '*'`. Tighten before production.

## Scripts
| Command | Purpose |
|---|---|
| `npm run start:dev` | `nest start --watch` against `.env` (dev DB) |
| `npm run build` | `nest build` → `dist/` |
| `npm run typecheck` | `tsc --noEmit --incremental false` |
| `npm run prisma:generate` | regenerate Prisma client |
| `npm run prisma:migrate` | `prisma migrate dev` (interactive) |
| `npm run prisma:seed` | `ts-node prisma/seed.ts` |
| `npm run test:e2e` | jest e2e against `laundry_test` DB ([test/jest-e2e.json](../../test/jest-e2e.json)) |

## Two databases
- `laundry_service` (`.env`) — dev work.
- `laundry_test` (`.env.test`) — automated tests only. [test/load-env.ts](../../test/load-env.ts) refuses to boot if `DATABASE_URL` does not contain `_test`.

## Realtime push surfaces
| Namespace | Auth | Room | Events | Defined in |
|---|---|---|---|---|
| `/billing` | Bearer JWT (CUSTOMER) | `customer:${customerId}` | `billing:created` | `src/modules/billing/interfaces/ws/billing.gateway.ts` |
| `/exception` | Bearer JWT (CUSTOMER) | `customer:${customerId}` (+ wash broadcast) | `exception:approval-requested`, `exception:approval-resolved`, `exception:route-change-requested`, `exception:route-change-resolved` | `src/modules/exception/interfaces/ws/exception.gateway.ts` |

Client implementation: `laundry-user-web/src/useRealtimeRequests.ts`. Client upserts by message id and **replaces** payload — server must always send the complete relevant set.
