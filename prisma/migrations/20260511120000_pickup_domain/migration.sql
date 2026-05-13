-- CreateEnum
CREATE TYPE "PickupRunStatus" AS ENUM ('ACTIVE', 'RETURNED');

-- CreateEnum
CREATE TYPE "PickupBagStatus" AS ENUM ('READY', 'TAKE_OUT', 'CONTAIN', 'TAKE_BACK');

-- CreateTable
CREATE TABLE "pickup_vehicles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_runs" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "status" "PickupRunStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_bags" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "status" "PickupBagStatus" NOT NULL DEFAULT 'READY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "current_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pickup_bags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_bag_items" (
    "id" TEXT NOT NULL,
    "pickup_bag_id" TEXT NOT NULL,
    "pickup_run_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_bag_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pickup_photos" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "pickup_run_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "photo_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pickup_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pickup_vehicles_code_key" ON "pickup_vehicles"("code");

-- CreateIndex
CREATE INDEX "pickup_runs_staff_id_status_idx" ON "pickup_runs"("staff_id", "status");

-- CreateIndex
CREATE INDEX "pickup_runs_vehicle_id_status_idx" ON "pickup_runs"("vehicle_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_bags_barcode_key" ON "pickup_bags"("barcode");

-- CreateIndex
CREATE INDEX "pickup_bags_current_run_id_status_idx" ON "pickup_bags"("current_run_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pickup_bag_items_order_item_id_key" ON "pickup_bag_items"("order_item_id");

-- CreateIndex
CREATE INDEX "pickup_bag_items_pickup_bag_id_idx" ON "pickup_bag_items"("pickup_bag_id");

-- CreateIndex
CREATE INDEX "pickup_bag_items_pickup_run_id_idx" ON "pickup_bag_items"("pickup_run_id");

-- CreateIndex
CREATE INDEX "pickup_bag_items_order_id_idx" ON "pickup_bag_items"("order_id");

-- CreateIndex
CREATE INDEX "pickup_photos_order_id_pickup_run_id_idx" ON "pickup_photos"("order_id", "pickup_run_id");

-- CreateIndex
CREATE INDEX "orders_status_pickup_schedule_created_at_idx" ON "orders"("status", "pickup_schedule", "created_at");

-- AddForeignKey
ALTER TABLE "pickup_runs" ADD CONSTRAINT "pickup_runs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "pickup_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_runs" ADD CONSTRAINT "pickup_runs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_bags" ADD CONSTRAINT "pickup_bags_current_run_id_fkey" FOREIGN KEY ("current_run_id") REFERENCES "pickup_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_bag_items" ADD CONSTRAINT "pickup_bag_items_pickup_bag_id_fkey" FOREIGN KEY ("pickup_bag_id") REFERENCES "pickup_bags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_bag_items" ADD CONSTRAINT "pickup_bag_items_pickup_run_id_fkey" FOREIGN KEY ("pickup_run_id") REFERENCES "pickup_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_bag_items" ADD CONSTRAINT "pickup_bag_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_bag_items" ADD CONSTRAINT "pickup_bag_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_photos" ADD CONSTRAINT "pickup_photos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_photos" ADD CONSTRAINT "pickup_photos_pickup_run_id_fkey" FOREIGN KEY ("pickup_run_id") REFERENCES "pickup_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pickup_photos" ADD CONSTRAINT "pickup_photos_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;
