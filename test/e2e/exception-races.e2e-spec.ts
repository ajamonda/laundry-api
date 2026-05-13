import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../utils/app';
import { disconnectTestPrisma, getTestPrisma, resetDb } from '../utils/db';
import {
  authedCustomer,
  createOrder,
  login,
  pickupTo,
  tagAll,
} from '../utils/flows';

/**
 * Concurrency tests for exception-domain CAS guards.
 *
 * Mirrors the pattern from billing-races: drive two parallel requests at a
 * single resource that can resolve exactly once, assert {201, 409} and
 * DB count == 1.
 *
 * Targets:
 *   1. Approval double-respond — CAS in RespondApprovalUseCase.
 *   2. Route-change double-approve — CAS in ApproveRouteChangeUseCase.
 *   3. Concurrent route-change requests for the same item — PendingRouteChangeExistsError guard.
 */
describe('exception-domain races', () => {
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

  it('rejects concurrent approval responses via CAS', async () => {
    const customerToken = await authedCustomer(http);
    const pickupToken = await login(http, '/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login(http, '/auth/staff/wash/dev-login', { staffId: 'w1' });

    const orderId = await createOrder(http, customerToken, 1);
    const itemIds = await pickupTo(http, orderId, pickupToken);
    await tagAll(http, itemIds, washToken);

    await http
      .post(`/wash/items/${itemIds[0]}/activate-exception-flow`)
      .set('Authorization', `Bearer ${washToken}`)
      .send({ flowCode: 'REPAIR_APPROVAL_FLOW' })
      .expect(201);

    // Advance override steps to WAIT_CUSTOMER_DECISION.
    const prisma = getTestPrisma();
    for (let i = 0; i < 5; i++) {
      const state = await prisma.itemProcessingState.findUniqueOrThrow({
        where: { orderItemId: itemIds[0] },
        include: { currentOverride: true },
      });
      if (state.currentOverride?.stepType === 'WAIT_CUSTOMER_DECISION') break;
      await http
        .post('/wash/tags/TAG-001/scan-step')
        .set('Authorization', `Bearer ${washToken}`)
        .expect(201);
    }

    const approval = await prisma.approvalRequest.findFirstOrThrow({
      where: { orderItemId: itemIds[0], status: 'WAITING' },
    });

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
    // Loser carries the contract error code.
    const loser = [r1, r2].find((r) => r.status === 409)!;
    expect(loser.body.code).toBe('EXCEPTION_APPROVAL_REQUEST_ALREADY_RESOLVED');

    // Approval resolved exactly once.
    const resolved = await prisma.approvalRequest.findUniqueOrThrow({
      where: { id: approval.id },
    });
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.decision).toBe('APPROVE_REPAIR');

    // Exactly one SUPPLEMENT row.
    const supplements = await prisma.billingRequest.findMany({
      where: { orderId, type: 'SUPPLEMENT', sourceType: 'APPROVAL_REQUEST', sourceId: approval.id },
    });
    expect(supplements).toHaveLength(1);
    expect(supplements[0].totalAmount).toBe(15000);
  });

  it('rejects concurrent route-change approvals via CAS', async () => {
    const customerToken = await authedCustomer(http);
    const pickupToken = await login(http, '/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login(http, '/auth/staff/wash/dev-login', { staffId: 'w1' });

    const orderId = await createOrder(http, customerToken, 1);
    const itemIds = await pickupTo(http, orderId, pickupToken);
    await tagAll(http, itemIds, washToken);

    const rc = await http
      .post(`/wash/items/${itemIds[0]}/request-route-change`)
      .set('Authorization', `Bearer ${washToken}`)
      .send({ toRouteCode: 'PREMIUM_CLEANING', additionalCost: 8000, reason: 'race test' })
      .expect(201);
    const routeChangeId: string = rc.body.id;

    const [r1, r2] = await Promise.all([
      http
        .post(`/wash/route-change-requests/${routeChangeId}/approve`)
        .set('Authorization', `Bearer ${customerToken}`),
      http
        .post(`/wash/route-change-requests/${routeChangeId}/approve`)
        .set('Authorization', `Bearer ${customerToken}`),
    ]);

    const codes = [r1.status, r2.status].sort();
    expect(codes).toEqual([201, 409]);
    const loser = [r1, r2].find((r) => r.status === 409)!;
    expect(loser.body.code).toBe('EXCEPTION_ROUTE_CHANGE_REQUEST_ALREADY_RESOLVED');

    const prisma = getTestPrisma();

    // Route change resolved exactly once.
    const after = await prisma.routeChangeRequest.findUniqueOrThrow({ where: { id: routeChangeId } });
    expect(after.status).toBe('APPROVED');

    // Exactly one SUPPLEMENT row keyed by the route-change source.
    const supplements = await prisma.billingRequest.findMany({
      where: {
        orderId,
        type: 'SUPPLEMENT',
        sourceType: 'ROUTE_CHANGE_REQUEST',
        sourceId: routeChangeId,
      },
    });
    expect(supplements).toHaveLength(1);
    expect(supplements[0].totalAmount).toBe(8000);
  });

  it('rejects a sequential second route-change while one is PENDING', async () => {
    // NOTE: this asserts the SEQUENTIAL guard (PendingRouteChangeExistsError).
    // True concurrent protection is NOT implemented today — `request-route-
    // change` performs a read-then-write without CAS / partial UNIQUE, so two
    // simultaneous requests for the same item can both succeed. The docs
    // (docs/exception-flow/README.md "Race / idempotency guarantees") do not
    // claim concurrent CAS for this endpoint. If/when added (e.g. partial
    // UNIQUE on `(orderItemId, status='PENDING')`), promote this test to a
    // Promise.all variant and assert {201, 409}.
    const customerToken = await authedCustomer(http);
    const pickupToken = await login(http, '/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login(http, '/auth/staff/wash/dev-login', { staffId: 'w1' });

    const orderId = await createOrder(http, customerToken, 1);
    const itemIds = await pickupTo(http, orderId, pickupToken);
    await tagAll(http, itemIds, washToken);

    const body = {
      toRouteCode: 'PREMIUM_CLEANING',
      additionalCost: 5000,
      reason: 'sequential request test',
    };
    await http
      .post(`/wash/items/${itemIds[0]}/request-route-change`)
      .set('Authorization', `Bearer ${washToken}`)
      .send(body)
      .expect(201);

    const second = await http
      .post(`/wash/items/${itemIds[0]}/request-route-change`)
      .set('Authorization', `Bearer ${washToken}`)
      .send(body);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('EXCEPTION_PENDING_ROUTE_CHANGE_EXISTS');

    const prisma = getTestPrisma();
    const pending = await prisma.routeChangeRequest.findMany({
      where: { orderItemId: itemIds[0], status: 'PENDING' },
    });
    expect(pending).toHaveLength(1);
  });
});
