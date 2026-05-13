-- item_processing_states: remove current_override_id
ALTER TABLE "item_processing_states" DROP COLUMN "current_override_id";

-- item_processing_overrides: drop old index and status, add new columns, add unique constraint
DROP INDEX IF EXISTS "item_processing_overrides_order_item_id_sort_order_idx";

ALTER TABLE "item_processing_overrides" DROP COLUMN "status";

ALTER TABLE "item_processing_overrides"
  ADD COLUMN "flow_code" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "current_offset" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "item_processing_overrides" ALTER COLUMN "flow_code" DROP DEFAULT;

ALTER TABLE "item_processing_overrides"
  ADD CONSTRAINT "item_processing_overrides_order_item_id_key" UNIQUE ("order_item_id");
