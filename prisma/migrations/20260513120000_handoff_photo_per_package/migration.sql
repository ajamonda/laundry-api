-- Switch delivery_handoff_photos from order-scoped (1:N) to package-scoped (1:1).
-- Prototype: drop existing rows rather than backfill.

ALTER TABLE "delivery_handoff_photos" DROP CONSTRAINT IF EXISTS "delivery_handoff_photos_order_id_fkey";

DROP INDEX IF EXISTS "delivery_handoff_photos_order_id_idx";

DELETE FROM "delivery_handoff_photos";

ALTER TABLE "delivery_handoff_photos" DROP COLUMN "order_id";

ALTER TABLE "delivery_handoff_photos"
  ADD COLUMN "package_id" TEXT NOT NULL,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "delivery_handoff_photos_package_id_key"
  ON "delivery_handoff_photos"("package_id");

ALTER TABLE "delivery_handoff_photos"
  ADD CONSTRAINT "delivery_handoff_photos_package_id_fkey"
  FOREIGN KEY ("package_id") REFERENCES "item_packages"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
