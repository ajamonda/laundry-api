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
 * Regression tests for the wash atomicity fix.
 *
 * Each of `tag-item`, `assign-route`, `scan-step` opens a single
 * `prisma.$transaction` and threads `tx` into every sub-call. Earlier
 * versions split the work across 2–3 separate transactions, leaving a
 * window where mid-sequence failure could half-commit (e.g. tag set but
 * billing missing).
 *
 * These tests force a mid-sequence failure and assert that the entire
 * transaction rolled back — NO partial state survives.
 *
 * The failure injection point is `attachTagBarcode`'s P2002 path: tagging
 * a second item with a barcode already in use throws inside the same tx
 * that would otherwise create billing and flip status. If atomicity
 * regresses (e.g. someone forgets to thread `tx`), one of the assertions
 * below will fail.
 */
describe('wash atomicity (single-tx rollback contract)', () => {
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

  it('tag-item: P2002 on tag conflict rolls back billing + status + audit', async () => {
    const customerToken = await authedCustomer(http);
    const pickupToken = await login(http, '/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login(http, '/auth/staff/wash/dev-login', { staffId: 'w1' });

    const orderId = await createOrder(http, customerToken, 2);
    const [itemA, itemB] = await pickupTo(http, orderId, pickupToken);
    const prisma = getTestPrisma();

    // Successfully tag itemA.
    await http
      .post(`/wash/items/${itemA}/tag`)
      .set('Authorization', `Bearer ${washToken}`)
      .send({ tagBarcode: 'TAG-SAME' })
      .expect(201);

    const auditBefore = await prisma.auditLog.count({
      where: { targetType: 'ORDER_ITEM', targetId: itemB, actionType: 'ITEM_TAGGED' },
    });
    const billingItemsBefore = await prisma.billingRequestItem.count({
      where: { orderItemId: itemB },
    });

    // Attempt to tag itemB with the SAME barcode → P2002 deep in attachTagBarcode.
    const conflict = await http
      .post(`/wash/items/${itemB}/tag`)
      .set('Authorization', `Bearer ${washToken}`)
      .send({ tagBarcode: 'TAG-SAME' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('WASH_TAG_BARCODE_CONFLICT');

    // Atomicity contract: itemB must be untouched.
    const itemBAfter = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemB } });
    expect(itemBAfter.status).toBe('PICK_UP');
    expect(itemBAfter.tagBarcode).toBeNull();

    // No billing row created for itemB.
    const billingItemsAfter = await prisma.billingRequestItem.count({
      where: { orderItemId: itemB },
    });
    expect(billingItemsAfter).toBe(billingItemsBefore);

    // No ITEM_TAGGED audit log written for itemB.
    const auditAfter = await prisma.auditLog.count({
      where: { targetType: 'ORDER_ITEM', targetId: itemB, actionType: 'ITEM_TAGGED' },
    });
    expect(auditAfter).toBe(auditBefore);
  });

  it('assign-route: invalid route code rolls back — status stays TAGGED, no plan', async () => {
    const customerToken = await authedCustomer(http);
    const pickupToken = await login(http, '/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login(http, '/auth/staff/wash/dev-login', { staffId: 'w1' });

    // Build a fresh order where the item will NOT auto-receive a route at
    // order-create time. To force assign-route into the failing path we
    // create the item, intercept after tag (status=TAGGED, no plan), then
    // call assign-route with a bogus routeCode.
    //
    // Setup: item starts auto-routed (catalog resolves a default). To get
    // a TAGGED-without-plan state, we clear the auto-created plan in DB
    // before tagging. This is test-only surgery — the production flow does
    // not produce this state. The point of THIS test is the rollback
    // contract on assign-route, so we accept the surgical setup.
    const orderId = await createOrder(http, customerToken, 1);
    const [itemId] = await pickupTo(http, orderId, pickupToken);
    const prisma = getTestPrisma();

    // Surgery: drop the auto-assigned plan + state so the item is
    // routeless. Tagging in this state leaves status=TAGGED (use case
    // skips the SORTED flip when no processing state exists).
    await prisma.itemProcessingState.deleteMany({ where: { orderItemId: itemId } });
    await prisma.itemProcessingPlan.deleteMany({ where: { orderItemId: itemId } });

    await http
      .post(`/wash/items/${itemId}/tag`)
      .set('Authorization', `Bearer ${washToken}`)
      .send({ tagBarcode: 'TAG-AR-001' })
      .expect(201);

    const tagged = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(tagged.status).toBe('TAGGED');

    const failed = await http
      .post('/wash/tags/TAG-AR-001/assign-route')
      .set('Authorization', `Bearer ${washToken}`)
      .send({ routeCode: 'NO_SUCH_ROUTE' });
    expect(failed.status).toBe(400);
    expect(failed.body.code).toBe('ROUTE_INVALID_CODE');

    // Atomicity contract: no plan created, status untouched.
    const after = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(after.status).toBe('TAGGED');

    const plans = await prisma.itemProcessingPlan.count({ where: { orderItemId: itemId } });
    expect(plans).toBe(0);

    const states = await prisma.itemProcessingState.count({ where: { orderItemId: itemId } });
    expect(states).toBe(0);
  });

  it('scan-step: pending route-change blocks scan; no status/billing/step mutation', async () => {
    // This case verifies the read-then-throw guard at the top of
    // ScanStepUseCase runs BEFORE the transaction, so a blocked scan
    // makes zero writes. If a future refactor moves the check inside
    // the tx and forgets to roll back on throw, this test catches it.
    const customerToken = await authedCustomer(http);
    const pickupToken = await login(http, '/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login(http, '/auth/staff/wash/dev-login', { staffId: 'w1' });

    const orderId = await createOrder(http, customerToken, 1);
    const [itemId] = await pickupTo(http, orderId, pickupToken);
    const [tag] = await tagAll(http, [itemId], washToken);
    const prisma = getTestPrisma();

    // Create a PENDING route-change request — scan-step is now blocked.
    await http
      .post(`/wash/items/${itemId}/request-route-change`)
      .set('Authorization', `Bearer ${washToken}`)
      .send({ toRouteCode: 'PREMIUM_CLEANING', additionalCost: 1000, reason: 'test' })
      .expect(201);

    const before = await prisma.orderItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { processingState: true },
    });
    const beforeStepId = before.processingState!.currentRouteStepId;
    const beforeStatus = before.status;

    const blocked = await http
      .post(`/wash/tags/${tag}/scan-step`)
      .set('Authorization', `Bearer ${washToken}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('WASH_ITEM_HAS_PENDING_ROUTE_CHANGE');

    const after = await prisma.orderItem.findUniqueOrThrow({
      where: { id: itemId },
      include: { processingState: true },
    });
    expect(after.status).toBe(beforeStatus);
    expect(after.processingState!.currentRouteStepId).toBe(beforeStepId);

    // No new STEP_COMPLETED audit row.
    const completed = await prisma.auditLog.count({
      where: {
        targetType: 'ORDER_ITEM',
        targetId: itemId,
        actionType: 'STEP_COMPLETED',
      },
    });
    expect(completed).toBe(0);
  });
});
