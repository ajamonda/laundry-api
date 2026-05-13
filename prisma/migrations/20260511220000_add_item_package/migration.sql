-- Add READY_TO_PACKAGE value to OrderItemStatus enum
ALTER TYPE "OrderItemStatus" ADD VALUE 'READY_TO_PACKAGE' BEFORE 'READY_FOR_DELIVERY';

-- Create item_packages table
CREATE TABLE "item_packages" (
  "id"         TEXT NOT NULL,
  "order_id"   TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "item_packages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "item_packages_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Add package_id FK column to order_items
ALTER TABLE "order_items"
  ADD COLUMN "package_id" TEXT;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "item_packages"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
