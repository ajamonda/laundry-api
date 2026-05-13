import { PrismaClient } from '@prisma/client';

let prismaSingleton: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }
  return prismaSingleton;
}

/**
 * Volatile tables to clear before each test, ordered child → parent so plain
 * DELETE works without CASCADE. CASCADE on TRUNCATE cascades by schema FK
 * (not by data), which would wipe seeded pickup_bags via the
 * pickup_bags.current_run_id → pickup_runs FK.
 */
const DELETE_ORDER = [
  'audit_logs',
  'payment_events',
  'billing_request_items',
  'billing_requests',
  'delivery_handoff_photos',
  'delivery_run_items',
  'delivery_runs',
  'item_processing_overrides',
  'item_processing_states',
  'item_process_events',
  'item_processing_plans',
  'item_exception_contexts',
  'approval_requests',
  'item_issues',
  'route_change_requests',
  'pickup_photos',
  'pickup_bag_items',
  'pickup_runs',
  'order_item_price_snapshots',
  'order_item_photos',
  'order_item_inputs',
  'order_item_options',
  'order_items',
  'item_packages',
  'orders',
  'customers',
  'staff',
];

export async function resetDb(prisma: PrismaClient = getTestPrisma()): Promise<void> {
  // Detach seeded pickup_bags from any active run first so we can DELETE the run rows.
  await prisma.$executeRawUnsafe(
    `UPDATE pickup_bags SET status = 'READY', current_run_id = NULL, active = true`,
  );

  for (const table of DELETE_ORDER) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prismaSingleton) {
    await prismaSingleton.$disconnect();
    prismaSingleton = null;
  }
}
