-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "tag_barcode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "order_items_tag_barcode_key" ON "order_items"("tag_barcode");
