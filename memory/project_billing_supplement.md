---
name: Billing supplement for exception flows
description: 수선 등 예외 흐름 발생 시 추가 청구 처리 방법 — exception-flow 2차 PR에서 구현
type: project
---

exception-flow(수선 등)로 추가 비용이 발생하면 기존 billing_request에 덮어쓰지 않고 별도 SUPPLEMENT 청구를 생성한다.

**Why:** 기본 세탁비는 이미 결제된 상태에서 추가 비용만 따로 승인하는 흐름이 UX상 자연스럽고, 청구 이력이 명확해짐.

**How to apply:**
- `billing_requests` 테이블에 `type: BASE | SUPPLEMENT` 컬럼 추가 (exception-flow 2차 PR)
- `orderId`의 `@unique` 제거해서 복수 청구 허용
- 수선 ApprovalRequest 승인 시 → SUPPLEMENT billing_request 생성 → socket `billing:created` 재발송
- 이 구현은 ApprovalRequest 엔드포인트와 함께 exception-flow 2차 PR에서 진행
