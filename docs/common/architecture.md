# Common Architecture

- `laundry-api` is a NestJS 11 + Prisma 6 + PostgreSQL modular monolith.
- The server owns all domain rules: status transitions, price calculation,
  processing route decisions, exception/override insertion, route changes,
  and billing/payment state.
- Clients submit user/operator actions and render API responses.
- APIs are action-oriented, not status CRUD (`scan-step`, `handoff`,
  `respond`, `request-route-change`).
- OpenAPI / Swagger is served at `/docs` so the four frontend apps can
  generate typed clients.
- Realtime push uses socket.io. Two namespaces exist today: `/billing` and
  `/exception`.
