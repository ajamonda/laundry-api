import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../utils/app';
import { disconnectTestPrisma, getTestPrisma, resetDb } from '../utils/db';

/**
 * Concurrency-focused tests for the four billing-domain races fixed in this
 * PR:
 *   1. Pay/Cancel double-action → CAS in resolveRequest.
 *   2. Parallel onItemReadyToPackage for sibling items → atomic CTE UPDATE.
 *   3. SUPPLEMENT billing duplicate via approval double-fire → CAS on
 *      approval status + UNIQUE(sourceType, sourceId).
 *   4. tag-item double-fire → idempotent createBillingRequest.
 *
 * Each test drives the API in two parallel requests and verifies the
 * expected outcome (count of successes, DB row counts) rather than any
 * timing.
 */
describe('billing-domain races', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    app = await createTestApp();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
    await disconnectTestPrisma();
  });

  beforeEach(async () => {
    await resetDb();
  });

  // ─── Helpers ────────────────────────────────────────────────────────────

  async function login(path: string, body: Record<string, string>) {
    const res = await http.post(path).send(body).expect(201);
    return res.body.accessToken as string;
  }

  async function authedCustomer() {
    const token = await login('/auth/customer/dev-login', { customerId: 'customer-1' });
    await http
      .patch('/auth/customer/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: '010-0000-0000', address: '서울시 강남구 테헤란로 1' })
      .expect(200);
    return token;
  }

  async function createOrder(customerToken: string, itemCount: number) {
    const items = Array.from({ length: itemCount }, () => ({
      itemCode: 'shirt',
      options: [{ groupCode: 'cleaning_method', optionCode: 'regular_wash' }],
    }));
    const res = await http
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        customerId: 'customer-1',
        fulfillmentType: 'DELIVERY',
        fulfillmentOptionCode: 'regular_delivery',
        address: '서울시 강남구 테헤란로 1',
        phoneNumber: '010-0000-0000',
        pickupDeliveryPlaceCode: 'front_door',
        items,
      })
      .expect(201);
    return res.body.id as string;
  }

  /** Walk one order from REQUEST to "all items IN_HOUSE/PICK_UP". */
  async function pickupTo(orderId: string, pickupToken: string) {
    const run = await http
      .post('/pickup/runs')
      .set('Authorization', `Bearer ${pickupToken}`)
      .send({ vehicleCode: 'PICKUP-VAN-01' })
      .expect(201);
    const runId: string = run.body.runId;
    await http
      .post(`/pickup/runs/${runId}/bags`)
      .set('Authorization', `Bearer ${pickupToken}`)
      .send({ bagBarcode: 'PICKUP-BAG-001' })
      .expect(201);
    const detail = await http
      .get(`/pickup/requests/${orderId}`)
      .set('Authorization', `Bearer ${pickupToken}`)
      .expect(200);
    const itemIds: string[] = detail.body.items.map((i: any) => i.itemId);
    await http
      .post(`/pickup/requests/${orderId}/photos`)
      .set('Authorization', `Bearer ${pickupToken}`)
      .send({ runId, photoUrl: 'https://example.com/p.jpg' })
      .expect(201);
    await http
      .post(`/pickup/bags/PICKUP-BAG-001/items`)
      .set('Authorization', `Bearer ${pickupToken}`)
      .send({ runId, orderId, itemIds })
      .expect(201);
    await http
      .post(`/pickup/bags/PICKUP-BAG-001/handoff`)
      .set('Authorization', `Bearer ${pickupToken}`)
      .send({ runId })
      .expect(201);
    return itemIds;
  }

  /** Tag each item; returns the tag barcodes (parallel-safe per-item IDs). */
  async function tagAll(itemIds: string[], washToken: string) {
    const tags: string[] = [];
    for (let i = 0; i < itemIds.length; i++) {
      const tag = `TAG-${String(i + 1).padStart(3, '0')}`;
      await http
        .post(`/wash/items/${itemIds[i]}/tag`)
        .set('Authorization', `Bearer ${washToken}`)
        .send({ tagBarcode: tag })
        .expect(201);
      tags.push(tag);
    }
    return tags;
  }

  /**
   * Walk an item's scan-steps until exactly one scan remains before plan
   * completion. The `READY_TO_PACKAGE` literal step auto-completes inside
   * scan-step, so we stop at the second-to-last step.
   */
  async function scanUntilOneScanLeft(tag: string, washToken: string) {
    const prisma = getTestPrisma();
    for (let i = 0; i < 20; i++) {
      const item = await prisma.orderItem.findFirstOrThrow({
        where: { tagBarcode: tag },
        include: { processingState: { include: { plan: { include: { route: { include: { steps: true } } } } } } },
      });
      if (item.status === 'READY_TO_PACKAGE') {
        throw new Error('overshot — already READY_TO_PACKAGE');
      }
      const steps = item.processingState!.plan.route.steps.sort((a, b) => a.sortOrder - b.sortOrder);
      const currentId = item.processingState!.currentRouteStepId;
      const currentIdx = steps.findIndex((s) => s.id === currentId);
      const remainingScans = steps.length - 1 - currentIdx; // last step auto-completes
      if (remainingScans <= 1) return;
      await http
        .post(`/wash/tags/${tag}/scan-step`)
        .set('Authorization', `Bearer ${washToken}`)
        .expect(201);
    }
    throw new Error('scanUntilOneScanLeft: too many iterations');
  }

  // ─── Test 1: Pay double-tap ─────────────────────────────────────────────

  it('rejects concurrent pay requests via CAS (race #1)', async () => {
    const customerToken = await authedCustomer();
    const pickupToken = await login('/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login('/auth/staff/wash/dev-login', { staffId: 'w1' });

    const orderId = await createOrder(customerToken, 1);
    const itemIds = await pickupTo(orderId, pickupToken);
    await tagAll(itemIds, washToken); // creates BASE billing in WAITING

    const prisma = getTestPrisma();
    const billing = await prisma.billingRequest.findFirstOrThrow({
      where: { orderId, type: 'BASE' },
    });

    const [r1, r2] = await Promise.all([
      http
        .post(`/billing/requests/${billing.id}/pay`)
        .set('Authorization', `Bearer ${customerToken}`),
      http
        .post(`/billing/requests/${billing.id}/pay`)
        .set('Authorization', `Bearer ${customerToken}`),
    ]);

    const codes = [r1.status, r2.status].sort();
    // One CAS winner (201), one conflict (409).
    expect(codes).toEqual([201, 409]);

    // Exactly one resolution event (SUCCEED) — BILLING_CREATED from
    // tag-item is unrelated.
    const events = await prisma.paymentEvent.findMany({
      where: {
        billingRequestId: billing.id,
        eventType: { in: ['PAYMENT_SUCCEED', 'PAYMENT_FAILED'] },
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('PAYMENT_SUCCEED');

    // Billing locked at PAID.
    const after = await prisma.billingRequest.findUniqueOrThrow({
      where: { id: billing.id },
    });
    expect(after.status).toBe('PAID');
  });

  it('rejects concurrent pay+cancel via CAS (race #1, mixed)', async () => {
    const customerToken = await authedCustomer();
    const pickupToken = await login('/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login('/auth/staff/wash/dev-login', { staffId: 'w1' });
    const orderId = await createOrder(customerToken, 1);
    const itemIds = await pickupTo(orderId, pickupToken);
    await tagAll(itemIds, washToken);

    const prisma = getTestPrisma();
    const billing = await prisma.billingRequest.findFirstOrThrow({
      where: { orderId, type: 'BASE' },
    });

    const [r1, r2] = await Promise.all([
      http
        .post(`/billing/requests/${billing.id}/pay`)
        .set('Authorization', `Bearer ${customerToken}`),
      http
        .post(`/billing/requests/${billing.id}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`),
    ]);

    const codes = [r1.status, r2.status].sort();
    expect(codes).toEqual([201, 409]);

    // Exactly one resolution event — no SUCCEED+FAILED duplicate.
    const events = await prisma.paymentEvent.findMany({
      where: {
        billingRequestId: billing.id,
        eventType: { in: ['PAYMENT_SUCCEED', 'PAYMENT_FAILED'] },
      },
    });
    expect(events).toHaveLength(1);

    const after = await prisma.billingRequest.findUniqueOrThrow({
      where: { id: billing.id },
    });
    expect(['PAID', 'CANCELLED']).toContain(after.status);
  });

  // ─── Test 2: Parallel onItemReadyToPackage ──────────────────────────────

  it('handles concurrent ready-to-package for sibling items without deadlock (race #2)', async () => {
    const customerToken = await authedCustomer();
    const pickupToken = await login('/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login('/auth/staff/wash/dev-login', { staffId: 'w1' });

    const orderId = await createOrder(customerToken, 3);
    const itemIds = await pickupTo(orderId, pickupToken);
    const tags = await tagAll(itemIds, washToken);

    // Walk every item to "one scan left" — the next scan completes the plan.
    for (const tag of tags) {
      await scanUntilOneScanLeft(tag, washToken);
    }

    // Fire the plan-completing scan in parallel for all 3 items.
    const results = await Promise.all(
      tags.map((t) =>
        http
          .post(`/wash/tags/${t}/scan-step`)
          .set('Authorization', `Bearer ${washToken}`),
      ),
    );

    // No deadlock victim — all three succeed.
    for (const r of results) expect(r.status).toBe(201);

    const prisma = getTestPrisma();
    const items = await prisma.orderItem.findMany({ where: { orderId } });
    expect(items.every((i) => i.status === 'READY_TO_PACKAGE')).toBe(true);

    // All BASE billings finalized + notified.
    const billings = await prisma.billingRequest.findMany({
      where: { orderId, type: 'BASE' },
    });
    expect(billings).toHaveLength(3);
    expect(billings.every((b) => b.notifiedAt !== null)).toBe(true);
  });

  // ─── Test 3: SUPPLEMENT billing idempotency on approval double-fire ─────

  it('creates only one SUPPLEMENT billing for concurrent approval responses (race #3)', async () => {
    const customerToken = await authedCustomer();
    const pickupToken = await login('/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login('/auth/staff/wash/dev-login', { staffId: 'w1' });

    const orderId = await createOrder(customerToken, 1);
    const itemIds = await pickupTo(orderId, pickupToken);
    await tagAll(itemIds, washToken);

    // Activate REPAIR_APPROVAL_FLOW — creates an approval request.
    await http
      .post(`/wash/items/${itemIds[0]}/activate-exception-flow`)
      .set('Authorization', `Bearer ${washToken}`)
      .send({ flowCode: 'REPAIR_APPROVAL_FLOW' })
      .expect(201);

    // Advance override steps until we reach WAIT_CUSTOMER_DECISION (the use
    // case's design is: activate → REPAIR_ESTIMATE step is active; a
    // wash-side scan completes that and moves to REQUEST_CUSTOMER_APPROVAL,
    // then to WAIT_CUSTOMER_DECISION which blocks scans).
    const prisma = getTestPrisma();
    for (let i = 0; i < 5; i++) {
      const state = await prisma.itemProcessingState.findUniqueOrThrow({
        where: { orderItemId: itemIds[0] },
        include: { currentOverride: true },
      });
      const stepType = state.currentOverride?.stepType ?? '';
      if (stepType === 'WAIT_CUSTOMER_DECISION') break;
      await http
        .post(`/wash/tags/TAG-001/scan-step`)
        .set('Authorization', `Bearer ${washToken}`)
        .expect(201);
    }

    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { orderItemId: itemIds[0], status: 'WAITING' },
    });

    // Fire the approval response twice in parallel.
    const body = { decision: 'APPROVE_REPAIR', extraAmount: 15000 };
    const [r1, r2] = await Promise.all([
      http
        .post(`/wash/approval-requests/${approval.id}/respond`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(body),
      http
        .post(`/wash/approval-requests/${approval.id}/respond`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send(body),
    ]);

    const codes = [r1.status, r2.status].sort();
    expect(codes).toEqual([201, 409]);

    // Exactly one SUPPLEMENT row with the requested amount.
    const supplements = await prisma.billingRequest.findMany({
      where: { orderId, type: 'SUPPLEMENT' },
    });
    expect(supplements).toHaveLength(1);
    expect(supplements[0].totalAmount).toBe(15000);
    expect(supplements[0].sourceType).toBe('APPROVAL_REQUEST');
    expect(supplements[0].sourceId).toBe(approval.id);
    // 기획: SUPPLEMENT는 생성 시점에 즉시 push되지 않음 — 다음 READY_TO_PACKAGE
    // 트리거에서 BASE와 함께 일괄 발송.
    expect(supplements[0].notifiedAt).toBeNull();
  });

  // ─── Spec test: SUPPLEMENT은 다음 READY_TO_PACKAGE에서 BASE와 함께 발송 ──

  it('defers SUPPLEMENT push until the next READY_TO_PACKAGE trigger', async () => {
    // Use route-change as the SUPPLEMENT origin (cleaner than approval flow:
    // REPAIR_APPROVAL_FLOW seed has two consecutive WAIT_CUSTOMER_DECISION
    // steps which block scan-step after a single approval response).
    const customerToken = await authedCustomer();
    const pickupToken = await login('/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login('/auth/staff/wash/dev-login', { staffId: 'w1' });

    const orderId = await createOrder(customerToken, 1);
    const itemIds = await pickupTo(orderId, pickupToken);
    const [tag] = await tagAll(itemIds, washToken);

    // Item is now SORTED — route-change is allowed.
    const rc = await http
      .post(`/wash/items/${itemIds[0]}/request-route-change`)
      .set('Authorization', `Bearer ${washToken}`)
      .send({ toRouteCode: 'PREMIUM_CLEANING', additionalCost: 22600, reason: 'premium upgrade' })
      .expect(201);
    const routeChangeRequestId: string = rc.body.id;

    await http
      .post(`/wash/route-change-requests/${routeChangeRequestId}/approve`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);

    const prisma = getTestPrisma();

    // 1) Just after approval — SUPPLEMENT exists but has not been notified.
    const beforeRTP = await prisma.billingRequest.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    const supplementBefore = beforeRTP.find((b) => b.type === 'SUPPLEMENT');
    expect(supplementBefore).toBeDefined();
    expect(supplementBefore!.notifiedAt).toBeNull();
    expect(supplementBefore!.totalAmount).toBe(22600);
    // BASE also still unnotified — no item has reached READY_TO_PACKAGE yet.
    expect(beforeRTP.find((b) => b.type === 'BASE')!.notifiedAt).toBeNull();

    // 2) Walk the item to READY_TO_PACKAGE — that trigger pushes both rows.
    for (let i = 0; i < 20; i++) {
      const item = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemIds[0] } });
      if (item.status === 'READY_TO_PACKAGE') break;
      const res = await http.post(`/wash/tags/${tag}/scan-step`).set('Authorization', `Bearer ${washToken}`);
      if (res.status !== 201) break;
    }

    const afterRTP = await prisma.billingRequest.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    // 3) Both BASE and SUPPLEMENT are now notified — same trigger.
    expect(afterRTP.every((b) => b.notifiedAt !== null)).toBe(true);
    // 4) Source key on the SUPPLEMENT survives.
    const supplementAfter = afterRTP.find((b) => b.type === 'SUPPLEMENT')!;
    expect(supplementAfter.sourceType).toBe('ROUTE_CHANGE_REQUEST');
    expect(supplementAfter.sourceId).toBe(routeChangeRequestId);
  });

  // ─── Spec test: 첫 RTP에서 그 order의 모든 BASE가 한 번에 notify ────────

  it('claims every BASE of an order on the first READY_TO_PACKAGE trigger', async () => {
    const customerToken = await authedCustomer();
    const pickupToken = await login('/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login('/auth/staff/wash/dev-login', { staffId: 'w1' });

    const orderId = await createOrder(customerToken, 3);
    const itemIds = await pickupTo(orderId, pickupToken);
    const tags = await tagAll(itemIds, washToken);

    // 3 BASEs exist immediately after tagging, all unnotified.
    const prisma = getTestPrisma();
    const afterTag = await prisma.billingRequest.findMany({
      where: { orderId, type: 'BASE' },
    });
    expect(afterTag).toHaveLength(3);
    expect(afterTag.every((b) => b.notifiedAt === null)).toBe(true);

    // Walk ONLY item 1 to READY_TO_PACKAGE (other two are still PROCESSING).
    await scanUntilOneScanLeft(tags[0], washToken);
    await http.post(`/wash/tags/${tags[0]}/scan-step`).set('Authorization', `Bearer ${washToken}`).expect(201);

    // Confirm item 1 reached RTP and others are still processing.
    const items = await prisma.orderItem.findMany({ where: { orderId } });
    const item1 = items.find((i) => i.id === itemIds[0])!;
    expect(item1.status).toBe('READY_TO_PACKAGE');
    const others = items.filter((i) => i.id !== itemIds[0]);
    expect(others.every((i) => i.status !== 'READY_TO_PACKAGE')).toBe(true);

    // ⭐ Spec: a single RTP claims ALL of the order's WAITING billings.
    const after1RTP = await prisma.billingRequest.findMany({
      where: { orderId, type: 'BASE' },
    });
    expect(after1RTP.every((b) => b.notifiedAt !== null)).toBe(true);

    // Capture timestamps to detect re-notifications on subsequent triggers.
    const tsBeforeNext = new Map(after1RTP.map((b) => [b.id, b.notifiedAt!.getTime()]));

    // Now walk item 2 to RTP. No new SUPPLEMENT → emit should be suppressed,
    // notifiedAt timestamps should NOT change.
    await scanUntilOneScanLeft(tags[1], washToken);
    await http.post(`/wash/tags/${tags[1]}/scan-step`).set('Authorization', `Bearer ${washToken}`).expect(201);

    const afterItem2 = await prisma.billingRequest.findMany({
      where: { orderId, type: 'BASE' },
    });
    for (const b of afterItem2) {
      // notifiedAt unchanged (no new claim, so suppression-or-noop kept the stamp).
      expect(b.notifiedAt!.getTime()).toBe(tsBeforeNext.get(b.id));
    }
  });

  // ─── Spec test: Delivery는 SUPPLEMENT 미결제 시 출고 차단 ───────────────

  it('blocks scan-outbound when SUPPLEMENT is unpaid even if BASE is paid', async () => {
    const customerToken = await authedCustomer();
    const pickupToken = await login('/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login('/auth/staff/wash/dev-login', { staffId: 'w1' });
    const deliveryToken = await login('/auth/staff/delivery/dev-login', { staffId: 'd1' });

    const orderId = await createOrder(customerToken, 1);
    const itemIds = await pickupTo(orderId, pickupToken);
    const [tag] = await tagAll(itemIds, washToken);

    // Route-change로 SUPPLEMENT 생성 (위 SUPPLEMENT defer 테스트와 동일 패턴).
    const rc = await http
      .post(`/wash/items/${itemIds[0]}/request-route-change`)
      .set('Authorization', `Bearer ${washToken}`)
      .send({ toRouteCode: 'PREMIUM_CLEANING', additionalCost: 5000, reason: 'upgrade' })
      .expect(201);
    await http
      .post(`/wash/route-change-requests/${rc.body.id}/approve`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);

    const prisma = getTestPrisma();

    // RTP까지 진행 (BASE+SUPPLEMENT notified).
    for (let i = 0; i < 20; i++) {
      const item = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemIds[0] } });
      if (item.status === 'READY_TO_PACKAGE') break;
      const res = await http.post(`/wash/tags/${tag}/scan-step`).set('Authorization', `Bearer ${washToken}`);
      if (res.status !== 201) break;
    }

    // Package + only-BASE payment.
    const packagesRes = await http.post('/wash/packages').set('Authorization', `Bearer ${washToken}`).expect(201);
    const packageId: string = packagesRes.body.packages[0].packageId;

    const baseBilling = await prisma.billingRequest.findFirstOrThrow({
      where: { orderId, type: 'BASE' },
    });
    await http
      .post(`/billing/requests/${baseBilling.id}/pay`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);

    // Delivery run.
    await http
      .post('/delivery/runs')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ vehicleCode: 'DELIVERY_VAN_01' })
      .expect(201);

    // SUPPLEMENT 미결제 → outbound 차단.
    const blocked = await http
      .post(`/delivery/packages/${packageId}/scan-outbound`)
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(blocked.status).toBe(409);

    // SUPPLEMENT까지 결제 후엔 통과.
    const supplement = await prisma.billingRequest.findFirstOrThrow({
      where: { orderId, type: 'SUPPLEMENT' },
    });
    await http
      .post(`/billing/requests/${supplement.id}/pay`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);
    await http
      .post(`/delivery/packages/${packageId}/scan-outbound`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .expect(201);
  });

  // ─── Test 4: Tag-item double-fire — idempotent billing ──────────────────

  it('does not double-create BASE billing on tag-item double-fire (race #4)', async () => {
    const customerToken = await authedCustomer();
    const pickupToken = await login('/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login('/auth/staff/wash/dev-login', { staffId: 'w1' });

    const orderId = await createOrder(customerToken, 1);
    const itemIds = await pickupTo(orderId, pickupToken);

    // Fire two identical tag-item requests in parallel.
    const tag = 'TAG-001';
    const [r1, r2] = await Promise.all([
      http
        .post(`/wash/items/${itemIds[0]}/tag`)
        .set('Authorization', `Bearer ${washToken}`)
        .send({ tagBarcode: tag }),
      http
        .post(`/wash/items/${itemIds[0]}/tag`)
        .set('Authorization', `Bearer ${washToken}`)
        .send({ tagBarcode: tag }),
    ]);

    // Both succeed (same item, same tag — no unique violation) OR one
    // succeeds while the other sees the item is no longer PICK_UP.
    // Either way, billing must not double up.
    expect([r1.status, r2.status]).toEqual(expect.arrayContaining([201]));

    const prisma = getTestPrisma();
    const billings = await prisma.billingRequest.findMany({
      where: { orderId, type: 'BASE' },
    });
    expect(billings).toHaveLength(1);

    const items = await prisma.billingRequestItem.findMany({
      where: { orderItemId: itemIds[0] },
    });
    expect(items).toHaveLength(1);
  });
});
