# Auth / Customer / Staff

## Goal

Customer identity and staff identity are kept separate — they have different
profile requirements, access rules, and likely different real-auth paths
later. The MVP never combines them into a single `Actor`.

## Subjects

`Customer` (`customers` table): `customerId`, optional `phoneNumber`, optional `address`.
`Staff` (`staff` table): `staffId`, `role`, optional `displayName`, optional `phoneNumber`.

Staff roles (`StaffRole` enum): `PICKUP`, `WASH`, `DELIVERY`, `ADMIN`.

Profile completion is required for customers (phone + address) before
workflows that need contact/address info. Staff have no profile completion
requirement in the MVP.

## Token Payload

Customer:
```json
{ "subjectType": "CUSTOMER", "customerId": "customer-1" }
```

Staff:
```json
{ "subjectType": "STAFF", "staffId": "staff-1", "staffRole": "PICKUP" }
```

## API

| Method | Path | Notes |
|---|---|---|
| `POST` | `/auth/customer/dev-login` | Body `{ customerId }`. Response includes `requiresProfileCompletion` and `missingFields` when phone/address missing. |
| `PATCH` | `/auth/customer/me/profile` | Body `{ phoneNumber, address }` |
| `POST` | `/auth/staff/pickup/dev-login` | Endpoint path determines the role — body must NOT carry a role. |
| `POST` | `/auth/staff/wash/dev-login` | |
| `POST` | `/auth/staff/delivery/dev-login` | |
| `POST` | `/auth/staff/admin/dev-login` | |

No real password/PG flow in the MVP. `dev-login` upserts the subject record.

## Guards

- `CustomerAuthGuard` for customer endpoints; injects `CurrentCustomer`.
- `StaffAuthGuard` + `@StaffRoles(...)` for staff endpoints; injects `CurrentStaff`.
- `CurrentPrincipal` exists only at the auth boundary — use cases receive the
  concrete `CustomerPrincipal` or `StaffPrincipal`.

## Access Summary

- Customer-only: order creation, profile update, pricing estimate, billing pay/cancel, approval/route-change responses.
- `PICKUP` (or `ADMIN`): pickup APIs.
- `WASH` (or `ADMIN`): wash APIs, raise-issue, activate-exception-flow, request-route-change.
- `DELIVERY` (or `ADMIN`): delivery APIs.
- `ADMIN`: audit-log read.

## Actor Snapshot

`AuditLog` and `ItemProcessEvent` store the principal as
`{ actorType, actorId, staffRole? }`. Customer rows have `staffRole = null`;
staff rows include the role used for authorization.
