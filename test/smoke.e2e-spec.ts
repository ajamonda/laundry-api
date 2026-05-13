import { PrismaClient } from '@prisma/client';

describe('test harness smoke', () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to the test database', async () => {
    expect(process.env.DATABASE_URL).toMatch(/laundry_test/);
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(rows[0].ok).toBe(1);
  });

  it('seeded catalog items + processing routes are present', async () => {
    const items = await prisma.catalogItem.count();
    const routes = await prisma.processingRoute.count();
    const steps = await prisma.processingRouteStep.count();
    expect(items).toBeGreaterThan(0);
    expect(routes).toBeGreaterThan(0);
    expect(steps).toBeGreaterThan(0);
  });
});
