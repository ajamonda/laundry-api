-- CreateTable
CREATE TABLE "delivery_vehicles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_runs" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "delivery_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_run_items" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_handoff_photos" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_handoff_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_vehicles_code_key" ON "delivery_vehicles"("code");

-- CreateIndex
CREATE INDEX "delivery_runs_staff_id_status_idx" ON "delivery_runs"("staff_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_run_items_order_item_id_key" ON "delivery_run_items"("order_item_id");

-- CreateIndex
CREATE INDEX "delivery_handoff_photos_order_id_idx" ON "delivery_handoff_photos"("order_id");

-- AddForeignKey
ALTER TABLE "delivery_runs" ADD CONSTRAINT "delivery_runs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "delivery_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_run_items" ADD CONSTRAINT "delivery_run_items_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "delivery_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_run_items" ADD CONSTRAINT "delivery_run_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_handoff_photos" ADD CONSTRAINT "delivery_handoff_photos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
