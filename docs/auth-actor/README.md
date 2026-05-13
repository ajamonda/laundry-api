# Auth / Actor

`src/modules/auth/`

## Subjects (disjoint — never merged)

| Subject | Table | Identifier | Required profile |
|---|---|---|---|
| Customer | `customers` | `customerId` (string, unique) | `phoneNumber`, `address` (both required for order flows) |
| Staff | `staff` | `staffId` (string, unique) + `role` | `displayName` optional |

Staff roles (`StaffRole` enum): `PICKUP`, `WASH`, `DELIVERY`, `ADMIN`.

## Token payloads

```ts
// Customer
{ subjectType: 'CUSTOMER', customerId: string }

// Staff
{ subjectType: 'STAFF', staffId: string, staffRole: StaffRole }
```

JWT signed with `JWT_SECRET`. No password flow in MVP.

## Endpoints

| Method | Path | Body | Notes |
|---|---|---|---|
| `POST` | `/auth/customer/dev-login` | `{ customerId }` | Upserts `customers` row. Response includes `requiresProfileCompletion` + `missingFields` |
| `PATCH` | `/auth/customer/me/profile` | `{ phoneNumber, address }` | Customer token required |
| `POST` | `/auth/staff/pickup/dev-login` | `{ staffId }` | Role determined by path, **not** body |
| `POST` | `/auth/staff/wash/dev-login` | `{ staffId }` | |
| `POST` | `/auth/staff/delivery/dev-login` | `{ staffId }` | |
| `POST` | `/auth/staff/admin/dev-login` | `{ staffId }` | |

## Guards

| Guard | Decorator | Injects | Defined in |
|---|---|---|---|
| `CustomerAuthGuard` | — | `CustomerPrincipal` via `@CurrentCustomer()` | `src/common/auth/customer-auth.guard.ts` |
| `StaffAuthGuard` | `@StaffRoles('WASH', 'ADMIN', ...)` | `StaffPrincipal` via `@CurrentStaff()` | `src/common/auth/staff-auth.guard.ts` |

## Access rules (enforced by guards)

| Resource class | Required |
|---|---|
| Customer-only (orders, profile, billing pay/cancel, approval respond, route-change approve/reject) | `CustomerAuthGuard` |
| Pickup APIs | `StaffAuthGuard` + `@StaffRoles('PICKUP')` |
| Wash APIs | `StaffAuthGuard` + `@StaffRoles('WASH')` |
| Delivery APIs | `StaffAuthGuard` + `@StaffRoles('DELIVERY')` |
| `/audit-logs` | `StaffAuthGuard` + `@StaffRoles('ADMIN')` |

## Invariants

- Never mix `CustomerAuthGuard` and `StaffAuthGuard` on the same endpoint.
- Customer ownership checks traverse `<entity>.order.customer.customerId === requesting.customerId`. **Never** compare to `order.customer_id` (UUID PK).
- WS auth uses `socket.handshake.auth.token` (Bearer JWT) and joins room `customer:${customerId}`. Bad token → `client.disconnect()`.

## Actor snapshot (used by audit + process events)

```ts
{ actorType: 'CUSTOMER' | 'STAFF', actorId: string, staffRole: StaffRole | null }
```
- Customer actions: `actorType='CUSTOMER'`, `staffRole=null`.
- Staff actions: `actorType='STAFF'`, `staffRole=<the role used for auth>`.

## When you change this domain

- Add a new staff role → update `StaffRole` enum (Prisma) + migration + guards' role checks + this README's role table.
- Add a customer profile requirement → update `complete-customer-profile.use-case.ts` + `requiresProfileCompletion` logic in dev-login + this README.
- Add a new principal field → update token signing in `customer-dev-login.use-case.ts` / `staff-dev-login.use-case.ts`, the principal type in `src/common/auth/current-principal.ts`, both guards, and both WS gateways.
