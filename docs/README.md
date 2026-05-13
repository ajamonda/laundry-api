# laundry-api Domain Docs

Engineering specs split per domain. Each subfolder has a `README.md` describing
the domain's responsibilities, current HTTP API, key state transitions, and
cross-domain wiring. DB schema is **not** duplicated here — read
`prisma/schema.prisma` for the authoritative model definitions.

## Documents

- [Common Architecture](./common/architecture.md)
- [Coding Style](./common/coding-style.md)
- [Auth / Actor](./auth-actor/README.md)
- [Catalog / Pricing / Orders](./catalog-pricing/README.md)
- [Pickup](./pickup/README.md)
- [Processing Route](./processing-route/README.md)
- [Exception Flow](./exception-flow/README.md)
- [Wash / Factory Operations](./wash-factory/README.md)
- [Billing](./billing/README.md)
- [Delivery](./delivery/README.md)
- [Audit / Event](./audit-event/README.md)

## MVP Flow

1. Customer creates an order; items start at `INIT` / `CUSTOMER_PICK_UP`.
2. Pickup operator collects items into pickup bags and hands them off to the factory.
3. Wash operator opens bags, tags items, assigns a processing route, scans steps, raises exceptions or route changes when needed.
4. Billing is auto-created when the last item in an order reaches `SORTED`; the customer pays or cancels.
5. Delivery operator scans packages outbound (requires paid BASE billing) and hands them off to the customer.
