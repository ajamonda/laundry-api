import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const routes = await prisma.processingRoute.findMany({
    orderBy: { code: 'asc' },
    include: {
      _count: { select: { steps: true } },
    },
  });

  console.log(`Total routes: ${routes.length}`);
  for (const route of routes) {
    console.log(`  ${route.code}: ${route._count.steps} steps (${route.displayName})`);
  }

  const totalSteps = await prisma.processingRouteStep.count();
  console.log(`Total steps: ${totalSteps}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
