import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../utils/app';
import { disconnectTestPrisma, getTestPrisma, resetDb } from '../utils/db';
import {
  authedCustomer,
  createOrder,
  login,
  pickupTo,
  scanUntilOneScanLeft,
  tagAll,
} from '../utils/flows';

/**
 * Concurrency / gate tests for the delivery domain.
 *
 * Targets:
 *   1. Billing gate — scan-outbound MUST 409 when any WAITING billing exists.
 *      Verified by a fresh package whose BASE is unpaid.
 *   2. Concurrent handoff for the same package — only one wins; status flips
 *      DELIVERING → FINISHED exactly once.
 */
describe('delivery-domain races', () => {
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

  async function walkOneItemToPackage(
    customerToken: string,
    pickupToken: string,
    washToken: string,
  ): Promise<{ orderId: string; itemId: string; packageId: string; tag: string }> {
    const orderId = await createOrder(http, customerToken, 1);
    const [itemId] = await pickupTo(http, orderId, pickupToken);
    const [tag] = await tagAll(http, [itemId], washToken);
    await scanUntilOneScanLeft(http, tag, washToken);
    await http
      .post(`/wash/tags/${tag}/scan-step`)
      .set('Authorization', `Bearer ${washToken}`)
      .expect(201);
    const packagesRes = await http
      .post('/wash/packages')
      .set('Authorization', `Bearer ${washToken}`)
      .expect(201);
    const packageId: string = packagesRes.body.packages[0].packageId;
    return { orderId, itemId, packageId, tag };
  }

  it('blocks scan-outbound with 409 when BASE billing is unpaid', async () => {
    const customerToken = await authedCustomer(http);
    const pickupToken = await login(http, '/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login(http, '/auth/staff/wash/dev-login', { staffId: 'w1' });
    const deliveryToken = await login(http, '/auth/staff/delivery/dev-login', { staffId: 'd1' });

    const { packageId } = await walkOneItemToPackage(customerToken, pickupToken, washToken);

    // Delivery run set up — but BASE billing is still WAITING.
    await http
      .post('/delivery/runs')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ vehicleCode: 'DELIVERY_VAN_01' })
      .expect(201);

    const blocked = await http
      .post(`/delivery/packages/${packageId}/scan-outbound`)
      .set('Authorization', `Bearer ${deliveryToken}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('DELIVERY_BILLING_NOT_PAID');

    // After paying BASE, the same call succeeds.
    const prisma = getTestPrisma();
    const billing = await prisma.billingRequest.findFirstOrThrow({
      where: { type: 'BASE' },
    });
    await http
      .post(`/billing/requests/${billing.id}/pay`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);

    await http
      .post(`/delivery/packages/${packageId}/scan-outbound`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .expect(201);
  });

  it('resolves concurrent handoff for the same package — one wins, items finalize exactly once', async () => {
    const customerToken = await authedCustomer(http);
    const pickupToken = await login(http, '/auth/staff/pickup/dev-login', { staffId: 'p1' });
    const washToken = await login(http, '/auth/staff/wash/dev-login', { staffId: 'w1' });
    const deliveryToken = await login(http, '/auth/staff/delivery/dev-login', { staffId: 'd1' });

    const { itemId, packageId } = await walkOneItemToPackage(customerToken, pickupToken, washToken);

    // Pay BASE and load the package onto the truck.
    const prisma = getTestPrisma();
    const billing = await prisma.billingRequest.findFirstOrThrow({
      where: { type: 'BASE' },
    });
    await http
      .post(`/billing/requests/${billing.id}/pay`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);
    await http
      .post('/delivery/runs')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ vehicleCode: 'DELIVERY_VAN_01' })
      .expect(201);
    await http
      .post(`/delivery/packages/${packageId}/scan-outbound`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .expect(201);

    // Fire two handoff calls in parallel against the same package.
    const [r1, r2] = await Promise.all([
      http
        .post(`/delivery/packages/${packageId}/handoff`)
        .set('Authorization', `Bearer ${deliveryToken}`),
      http
        .post(`/delivery/packages/${packageId}/handoff`)
        .set('Authorization', `Bearer ${deliveryToken}`),
    ]);

    const codes = [r1.status, r2.status].sort();
    // First call flips items DELIVERING → FINISHED; second sees items no
    // longer DELIVERING and 409s with DELIVERY_PACKAGE_NOT_HANDOFFABLE.
    expect(codes).toEqual([201, 409]);
    const loser = [r1, r2].find((r) => r.status === 409)!;
    expect(loser.body.code).toBe('DELIVERY_PACKAGE_NOT_HANDOFFABLE');

    // Item finalized exactly once.
    const item = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.status).toBe('FINISHED');
    expect(item.location).toBe('CUSTOMER_DEST');
  });
});
