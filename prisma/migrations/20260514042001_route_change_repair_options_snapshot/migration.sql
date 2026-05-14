-- AlterTable
ALTER TABLE "delivery_handoff_photos" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "route_change_requests" ADD COLUMN     "repair_options_snapshot" JSONB;
