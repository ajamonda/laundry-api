-- CreateTable
CREATE TABLE "billing_requests" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "total_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "billing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_request_items" (
    "id" TEXT NOT NULL,
    "billing_request_id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "billing_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "billing_request_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_requests_order_id_key" ON "billing_requests"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_request_items_order_item_id_key" ON "billing_request_items"("order_item_id");

-- CreateIndex
CREATE INDEX "payment_events_billing_request_id_created_at_idx" ON "payment_events"("billing_request_id", "created_at");

-- AddForeignKey
ALTER TABLE "billing_requests" ADD CONSTRAINT "billing_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_request_items" ADD CONSTRAINT "billing_request_items_billing_request_id_fkey" FOREIGN KEY ("billing_request_id") REFERENCES "billing_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_request_items" ADD CONSTRAINT "billing_request_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_billing_request_id_fkey" FOREIGN KEY ("billing_request_id") REFERENCES "billing_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
