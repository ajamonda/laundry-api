import * as request from 'supertest';
import { getTestPrisma } from './db';

/**
 * Shared e2e helpers for driving a fresh DB through the standard
 * customer → pickup → wash spine. New e2e spec files should reuse these
 * rather than re-inlining 50+ lines of setup per file.
 *
 * Contract:
 *   - Each helper takes the supertest agent (`http`) as its first arg.
 *     The agent is created by `request(app.getHttpServer())` in a spec's
 *     `beforeAll`.
 *   - Helpers do NOT call `resetDb()` — callers control the lifecycle.
 *   - All helpers `.expect(2xx)` on intermediate steps; a failure here is
 *     a test-setup bug, not a behaviour assertion.
 */

type Http = ReturnType<typeof request>;

export async function login(
  http: Http,
  path: string,
  body: Record<string, string>,
): Promise<string> {
  const res = await http.post(path).send(body).expect(201);
  return res.body.accessToken as string;
}

export async function authedCustomer(http: Http): Promise<string> {
  const token = await login(http, '/auth/customer/dev-login', { customerId: 'customer-1' });
  await http
    .patch('/auth/customer/me/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ phoneNumber: '010-0000-0000', address: '서울시 강남구 테헤란로 1' })
    .expect(200);
  return token;
}

export async function createOrder(
  http: Http,
  customerToken: string,
  itemCount: number,
): Promise<string> {
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

/** Walk one order from REQUEST → all items IN_HOUSE/PICK_UP. */
export async function pickupTo(
  http: Http,
  orderId: string,
  pickupToken: string,
): Promise<string[]> {
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
  const itemIds: string[] = detail.body.items.map((i: { itemId: string }) => i.itemId);
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

/** Tag each item; returns the assigned tag barcodes. */
export async function tagAll(
  http: Http,
  itemIds: string[],
  washToken: string,
): Promise<string[]> {
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
 * completion. The literal READY_TO_PACKAGE step auto-completes inside
 * scan-step, so we stop at the second-to-last step.
 *
 * Caller invokes one more `POST /wash/tags/:tag/scan-step` to flip the
 * item to READY_TO_PACKAGE.
 */
export async function scanUntilOneScanLeft(
  http: Http,
  tag: string,
  washToken: string,
): Promise<void> {
  const prisma = getTestPrisma();
  for (let i = 0; i < 20; i++) {
    const item = await prisma.orderItem.findFirstOrThrow({
      where: { tagBarcode: tag },
      include: {
        processingState: {
          include: { plan: { include: { route: { include: { steps: true } } } } },
        },
      },
    });
    if (item.status === 'READY_TO_PACKAGE') {
      throw new Error('overshot — already READY_TO_PACKAGE');
    }
    const steps = item.processingState!.plan.route.steps.sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const currentId = item.processingState!.currentRouteStepId;
    const currentIdx = steps.findIndex((s) => s.id === currentId);
    const remainingScans = steps.length - 1 - currentIdx;
    if (remainingScans <= 1) return;
    await http
      .post(`/wash/tags/${tag}/scan-step`)
      .set('Authorization', `Bearer ${washToken}`)
      .expect(201);
  }
  throw new Error('scanUntilOneScanLeft: too many iterations');
}
