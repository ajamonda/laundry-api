# Billing

## 개요

`BillingRequest`는 두 타입이 있음:

- **BASE** — `tag-item` 시점에 item마다 1개씩 생성. `totalAmount`는 tag 시점의 `orderItem.estimatedMinAmount`로 **freeze** (그 이후 절대 변경되지 않음).
- **SUPPLEMENT** — route-change 승인 / approval 응답 시점에 추가 비용만큼 생성. `totalAmount`는 양수/음수 모두 허용 (MVP — 음수는 환불성).

두 타입 모두 생성 시점엔 `notifiedAt = null`로 두고, **고객에게 push되는 것은 어떤 item이든 `READY_TO_PACKAGE`에 도달할 때만**. 그때 atomic claim으로 그 order의 모든 미통보 WAITING row를 한꺼번에 notify 마킹하고, `/billing` 소켓으로 `BillingRequest[]` 페이로드를 1건 emit.

user-web 클라이언트는 페이로드를 `orderId`로 그룹핑하고 `totalAmount`를 합산하여 한 카드로 표시 (BASE + 모든 SUPPLEMENT 합계).

## Push 트리거 — 표 (모든 경우)

| # | 시나리오 | Push? | 페이로드 |
|---|---|---|---|
| 1 | 단일 item order의 RTP 도달 | ✅ | `[BASE_item1]` |
| 2 | 다중 item order의 **첫** RTP 도달 | ✅ | `[BASE_item1, ..., BASE_itemN]` — tag 시점에 이미 모든 BASE가 만들어졌으므로 한꺼번에 claim |
| 3 | 다중 item order의 2번째 이후 RTP — 사이에 SUPPLEMENT 추가 없음 | ❌ | (claim 대상 0건이면 emit 생략) |
| 4 | RTP 도달 + 사이에 route-change/approval로 SUPPLEMENT 생성됨 | ✅ | 그 order의 모든 WAITING (이미 notify된 것 포함, 클라이언트 replace upsert 때문) |

다음 시점은 push **안 함**:
- Order 생성, tag-item (BASE 생성), approval 응답 (SUPPLEMENT 생성), route-change 승인 (SUPPLEMENT 생성), pay/cancel, 일반 scan-step (RTP 아닌 경우), reconnect (대신 REST `GET /billing/requests` 사용).

## 트리거 흐름 — 코드 경로

```
POST /wash/items/:id/tag                              (item 마다)
  └─ TagItemUseCase
       └─ BillingService.onItemTagged
            └─ INSERT billing_request(type=BASE, notifiedAt=null,
                                      totalAmount=estimatedMinAmount)
            └─ INSERT billing_request_items
            (idempotent: P2002 시 기존 row 반환)

POST /wash/approval-requests/:id/respond  (decision=APPROVE_*, extraAmount>0)
  └─ RespondApprovalUseCase
       ├─ CAS approval status WAITING → RESOLVED
       └─ BillingService.createSupplementBillingForApproval
            └─ INSERT billing_request(type=SUPPLEMENT, notifiedAt=null,
                                      sourceType='APPROVAL_REQUEST',
                                      sourceId=approvalId)
            (idempotent: UNIQUE(sourceType, sourceId))

POST /wash/route-change-requests/:id/approve   (additionalCost ≠ 0)
  └─ ApproveRouteChangeUseCase
       ├─ CAS routeChange status PENDING → APPROVED
       ├─ routeEngine.switchRoute
       ├─ orderItemOption swap (cleaning_method)
       ├─ BillingService.createSupplementBillingForRouteChange
       │    └─ INSERT billing_request(type=SUPPLEMENT, notifiedAt=null,
       │                              sourceType='ROUTE_CHANGE_REQUEST',
       │                              sourceId=routeChangeRequestId)
       └─ orderItem.estimatedMinAmount += additionalCost
          (wash-web의 다음 route-change 차액 계산용 누적값)

POST /wash/tags/:tag/scan-step  (plan 완료 트리거)
  └─ ScanStepUseCase
       └─ item status PROCESSING → READY_TO_PACKAGE
       └─ BillingService.onItemReadyToPackage
            └─ repo.claimAndFetchWaiting(orderId)  [SINGLE TX]
                 ├─ updateMany SET notifiedAt=NOW
                 │   WHERE orderId AND status='WAITING' AND notifiedAt IS NULL
                 │   → just_claimed count
                 └─ findMany WHERE orderId AND status='WAITING'
                   → all WAITING (newly + previously notified)
            └─ if just_claimed > 0:
                 socket emit `billing:created` payload=allWaiting
```

## 멱등성 / Race 보호

| 보호 | 어디서 |
|---|---|
| Pay/Cancel CAS | `updateMany WHERE id AND status='WAITING'` + count 0 시 throw |
| BASE 중복 (tag-item 더블탭) | `billing_request_items.order_item_id` UNIQUE → P2002 catch → 기존 row 반환 |
| SUPPLEMENT 중복 (approval/route-change 더블탭) | (1) 호출자 CAS on request status, (2) `UNIQUE(sourceType, sourceId)` |
| `claimAndFetchWaiting` 데드락 | 단일 `updateMany` statement로 row lock 일괄 획득 — 순환 대기 불가 |
| 중복 emit | `just_claimed === 0` 시 emit 생략 |

## 금액 / 합산

- **BASE.totalAmount**: tag 시점 freeze. 이후 변하지 않음.
- **SUPPLEMENT.totalAmount**: 운영자(wash-web)가 산정해서 넣음. 양수/음수 모두 가능.
- **user-web의 화면 표시**: BASE + 모든 SUPPLEMENT의 `totalAmount`를 단순 합산 (클라이언트 `reduce`).

## API

| Method | Path | Guard | Notes |
|---|---|---|---|
| `GET` | `/billing/requests` | Customer | 내 WAITING + notified 목록 (재연결 복원용). `notifiedAt IS NULL` row는 제외 — push 전에는 고객 화면에 안 보임. |
| `GET` | `/billing/requests/:id` | Customer | 단건 조회. |
| `POST` | `/billing/requests/:id/pay` | Customer | CAS WAITING→PAID. |
| `POST` | `/billing/requests/:id/cancel` | Customer | CAS WAITING→CANCELLED. |

소유권 검증: `billingRequest.order.customer.customerId === requestingCustomerId`. UUID PK인 `order.customer_id`와 비교 금지.

## Delivery gate 연동

`scan-outbound`는 그 order의 모든 BASE + SUPPLEMENT가 결제 완료된 후에만 허용. `delivery.countWaitingBillings(orderId) > 0`이면 `BillingNotPaidError(409)`.

## WebSocket — `/billing`

- 인증: `socket.handshake.auth.token` (Bearer JWT, CUSTOMER).
- Room: `customer:${customerId}`.

| 이벤트 | 방향 | payload | 트리거 |
|---|---|---|---|
| `billing:created` | server → client | `BillingRequest[]` (그 order의 WAITING 전체) | item이 READY_TO_PACKAGE 도달 + 새로 claim한 row 1건 이상 |

## Schema

```prisma
model BillingRequest {
  id          String    @id @default(uuid())
  orderId     String    @map("order_id")
  type        String    @default("BASE")    // BASE / SUPPLEMENT
  sourceType  String?   @map("source_type") // SUPPLEMENT 멱등성 키
  sourceId    String?   @map("source_id")
  status      String    @default("WAITING") // WAITING / PAID / CANCELLED
  totalAmount Int       @map("total_amount")
  createdAt   DateTime  @default(now())
  resolvedAt  DateTime?
  notifiedAt  DateTime?

  @@index([orderId, type])
  @@unique([sourceType, sourceId])
}
```

## Module

`BillingModule`은 `BillingService`를 export. `WashModule`, `ExceptionModule`이 import.
