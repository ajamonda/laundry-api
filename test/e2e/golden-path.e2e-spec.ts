import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp } from '../utils/app';
import { disconnectTestPrisma, getTestPrisma, resetDb } from '../utils/db';

describe('golden path: order → pickup → wash → billing → delivery → FINISHED', () => {
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

  it('completes the full happy path for a single shirt order', async () => {
    // 1. Customer login + order creation
    const customerLogin = await http
      .post('/auth/customer/dev-login')
      .send({ customerId: 'customer-1' })
      .expect(201);
    const customerToken: string = customerLogin.body.accessToken;
    expect(customerToken).toBeTruthy();

    // Complete the customer profile so order creation has phone/address.
    await http
      .patch('/auth/customer/me/profile')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ phoneNumber: '010-0000-0000', address: '서울시 강남구 테헤란로 1' })
      .expect(200);

    const orderRes = await http
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        customerId: 'customer-1',
        fulfillmentType: 'DELIVERY',
        fulfillmentOptionCode: 'regular_delivery',
        address: '서울시 강남구 테헤란로 1',
        phoneNumber: '010-0000-0000',
        pickupDeliveryPlaceCode: 'front_door',
        items: [
          {
            itemCode: 'shirt',
            options: [{ groupCode: 'cleaning_method', optionCode: 'regular_wash' }],
          },
        ],
      })
      .expect(201);
    const orderId: string = orderRes.body.id;
    expect(orderId).toBeTruthy();

    // 2. Pickup staff: run + bag + items + handoff
    const pickupLogin = await http
      .post('/auth/staff/pickup/dev-login')
      .send({ staffId: 'pickup-staff-1' })
      .expect(201);
    const pickupToken: string = pickupLogin.body.accessToken;

    const pickupRun = await http
      .post('/pickup/runs')
      .set('Authorization', `Bearer ${pickupToken}`)
      .send({ vehicleCode: 'PICKUP-VAN-01' })
      .expect(201);
    const pickupRunId: string = pickupRun.body.runId;

    const bagBarcode = 'PICKUP-BAG-001';
    await http
      .post(`/pickup/runs/${pickupRunId}/bags`)
      .set('Authorization', `Bearer ${pickupToken}`)
      .send({ bagBarcode })
      .expect(201);

    const requestDetail = await http
      .get(`/pickup/requests/${orderId}`)
      .set('Authorization', `Bearer ${pickupToken}`)
      .expect(200);
    const itemIds: string[] = requestDetail.body.items.map((i: any) => i.itemId);
    expect(itemIds).toHaveLength(1);

    // Pickup photo is required before items can be placed into the bag.
    await http
      .post(`/pickup/requests/${orderId}/photos`)
      .set('Authorization', `Bearer ${pickupToken}`)
      .send({ runId: pickupRunId, photoUrl: 'https://example.com/pickup.jpg' })
      .expect(201);

    await http
      .post(`/pickup/bags/${bagBarcode}/items`)
      .set('Authorization', `Bearer ${pickupToken}`)
      .send({ runId: pickupRunId, orderId, itemIds })
      .expect(201);

    await http
      .post(`/pickup/bags/${bagBarcode}/handoff`)
      .set('Authorization', `Bearer ${pickupToken}`)
      .send({ runId: pickupRunId })
      .expect(201);

    // 3. Wash staff: tag → assign-route → scan-step (until plan complete) → packages
    const washLogin = await http
      .post('/auth/staff/wash/dev-login')
      .send({ staffId: 'wash-staff-1' })
      .expect(201);
    const washToken: string = washLogin.body.accessToken;

    const tagBarcode = 'TAG-001';
    await http
      .post(`/wash/items/${itemIds[0]}/tag`)
      .set('Authorization', `Bearer ${washToken}`)
      .send({ tagBarcode })
      .expect(201);

    // Route was auto-assigned at order creation (catalog resolves item+options →
    // route), and tag-item flips status TAGGED → SORTED when the plan exists.
    // No explicit /assign-route call is needed in the happy path.
    const prisma = getTestPrisma();
    const itemAfterTag = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemIds[0] } });
    expect(itemAfterTag.status).toBe('SORTED');

    // Scan steps until the item reaches READY_TO_PACKAGE.
    for (let i = 0; i < 10; i++) {
      const item = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemIds[0] } });
      if (item.status === 'READY_TO_PACKAGE') break;
      await http
        .post(`/wash/tags/${tagBarcode}/scan-step`)
        .set('Authorization', `Bearer ${washToken}`)
        .expect(201);
    }
    const itemAfterScans = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemIds[0] } });
    expect(itemAfterScans.status).toBe('READY_TO_PACKAGE');

    const packagesRes = await http
      .post('/wash/packages')
      .set('Authorization', `Bearer ${washToken}`)
      .expect(201);
    const packageId: string = packagesRes.body.packages?.[0]?.packageId;
    expect(packageId).toBeTruthy();

    const itemAfterPackage = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemIds[0] } });
    expect(itemAfterPackage.status).toBe('READY_FOR_DELIVERY');

    // 4. Customer pays the auto-created BASE billing
    const billingList = await http
      .get('/billing/requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    const billing = (billingList.body.requests ?? billingList.body).find(
      (b: any) => b.type === 'BASE' && b.status === 'WAITING',
    );
    expect(billing).toBeTruthy();
    await http
      .post(`/billing/requests/${billing.id}/pay`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);

    // 5. Delivery staff: run + outbound + handoff
    const deliveryLogin = await http
      .post('/auth/staff/delivery/dev-login')
      .send({ staffId: 'delivery-staff-1' })
      .expect(201);
    const deliveryToken: string = deliveryLogin.body.accessToken;

    await http
      .post('/delivery/runs')
      .set('Authorization', `Bearer ${deliveryToken}`)
      .send({ vehicleCode: 'DELIVERY_VAN_01' })
      .expect(201);

    await http
      .post(`/delivery/packages/${packageId}/scan-outbound`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .expect(201);

    await http
      .post(`/delivery/packages/${packageId}/handoff`)
      .set('Authorization', `Bearer ${deliveryToken}`)
      .expect(201);

    // 6. Order should be FINISHED
    const finalOrder = await prisma.laundryOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(finalOrder.status).toBe('FINISHED');
    const finalItem = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemIds[0] } });
    expect(finalItem.status).toBe('FINISHED');
    expect(finalItem.location).toBe('CUSTOMER_DEST');
  });
});
