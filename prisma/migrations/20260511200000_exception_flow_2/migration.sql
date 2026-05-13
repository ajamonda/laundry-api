-- AlterTable billing_requests: remove unique index, add type column
ALTER TABLE "billing_requests" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'BASE';
DROP INDEX "billing_requests_order_id_key";
CREATE INDEX "billing_requests_order_id_type_idx" ON "billing_requests"("order_id", "type");

-- CreateTable item_processing_overrides
CREATE TABLE "item_processing_overrides" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "base_step_sort_order" INTEGER NOT NULL,
    "step_type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_processing_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable item_exception_contexts
CREATE TABLE "item_exception_contexts" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "interrupted_sort_order" INTEGER,
    "resume_step_sort_order" INTEGER,
    "fallback_step_sort_order" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "item_exception_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_processing_overrides_order_item_id_sort_order_idx" ON "item_processing_overrides"("order_item_id", "sort_order");
CREATE UNIQUE INDEX "item_exception_contexts_order_item_id_key" ON "item_exception_contexts"("order_item_id");

-- AddForeignKey
ALTER TABLE "item_processing_overrides" ADD CONSTRAINT "item_processing_overrides_order_item_id_fkey"
    FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_exception_contexts" ADD CONSTRAINT "item_exception_contexts_order_item_id_fkey"
    FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
