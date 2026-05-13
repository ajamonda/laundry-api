-- item_processing_states: restore current_override_id
ALTER TABLE "item_processing_states" ADD COLUMN "current_override_id" TEXT;

ALTER TABLE "item_processing_states"
  ADD CONSTRAINT "item_processing_states_current_override_id_fkey"
  FOREIGN KEY ("current_override_id") REFERENCES "item_processing_overrides"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "item_processing_states_current_override_id_key"
  ON "item_processing_states"("current_override_id");

-- item_processing_overrides: drop unique constraint, add status, add index
ALTER TABLE "item_processing_overrides"
  DROP CONSTRAINT IF EXISTS "item_processing_overrides_order_item_id_key";

ALTER TABLE "item_processing_overrides"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "item_processing_overrides_order_item_id_status_idx"
  ON "item_processing_overrides"("order_item_id", "status");
