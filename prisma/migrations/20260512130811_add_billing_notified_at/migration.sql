-- AlterTable
ALTER TABLE "billing_requests" ADD COLUMN     "notified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "item_processing_overrides" ALTER COLUMN "updated_at" DROP DEFAULT;
