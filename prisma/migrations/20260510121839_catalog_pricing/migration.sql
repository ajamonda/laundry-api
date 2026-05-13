-- CreateEnum
CREATE TYPE "CatalogSelectionType" AS ENUM ('SINGLE', 'MULTI');

-- CreateEnum
CREATE TYPE "CatalogInputType" AS ENUM ('TEXT', 'NUMBER');

-- CreateEnum
CREATE TYPE "CatalogPriceType" AS ENUM ('FIXED', 'RANGE', 'UNIT', 'MATRIX', 'NONE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('REQUEST', 'PICK_UP', 'PROCESSING', 'PARTIAL_FINISHED', 'FINISHED');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('INIT', 'PICK_UP', 'TAGGED', 'SORTED', 'PROCESSING', 'READY_FOR_DELIVERY', 'DELIVERING', 'FINISHED');

-- CreateEnum
CREATE TYPE "OrderItemLocation" AS ENUM ('CUSTOMER_PICK_UP', 'PICK_UP_TRUCK', 'IN_HOUSE', 'PREMIUM', 'VENDOR', 'DELIVERING_TRUCK', 'CUSTOMER_DEST');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('DELIVERY', 'STORAGE');

-- CreateTable
CREATE TABLE "catalog_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "photo_required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_option_groups" (
    "id" TEXT NOT NULL,
    "catalog_item_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "selection_type" "CatalogSelectionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "min_select" INTEGER,
    "max_select" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_options" (
    "id" TEXT NOT NULL,
    "catalog_option_group_id" TEXT NOT NULL,
    "parent_option_id" TEXT,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "requires_input" BOOLEAN NOT NULL DEFAULT false,
    "input_type" "CatalogInputType",
    "input_unit" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_option_prices" (
    "id" TEXT NOT NULL,
    "catalog_option_id" TEXT NOT NULL,
    "price_type" "CatalogPriceType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "amount" INTEGER,
    "min_amount" INTEGER,
    "max_amount" INTEGER,
    "base_amount" INTEGER,
    "base_quantity" DECIMAL(10,2),
    "base_unit" TEXT,
    "extra_unit_quantity" DECIMAL(10,2),
    "extra_unit_amount" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_option_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_option_rules" (
    "id" TEXT NOT NULL,
    "catalog_item_id" TEXT NOT NULL,
    "catalog_option_group_id" TEXT,
    "catalog_option_id" TEXT,
    "rule_type" TEXT NOT NULL,
    "condition_group_code" TEXT,
    "condition_option_code" TEXT,
    "target_group_code" TEXT,
    "target_option_code" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_option_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_item_inputs" (
    "id" TEXT NOT NULL,
    "catalog_item_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "input_type" "CatalogInputType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_item_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_request_options" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "group_code" TEXT NOT NULL,
    "parent_option_id" TEXT,
    "requires_input" BOOLEAN NOT NULL DEFAULT false,
    "input_type" "CatalogInputType",
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_request_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'REQUEST',
    "pickup_schedule" TIMESTAMP(3),
    "fulfillment_type" "FulfillmentType",
    "fulfillment_option_code" TEXT,
    "address" TEXT,
    "phone_number" TEXT,
    "pickup_delivery_place_code" TEXT,
    "pickup_delivery_place_text" TEXT,
    "second_hand_pickup_requested" BOOLEAN NOT NULL DEFAULT false,
    "estimated_min_amount" INTEGER NOT NULL DEFAULT 0,
    "estimated_max_amount" INTEGER NOT NULL DEFAULT 0,
    "final_amount" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "catalog_item_id" TEXT NOT NULL,
    "catalog_item_code" TEXT NOT NULL,
    "display_name_snapshot" TEXT NOT NULL,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'INIT',
    "location" "OrderItemLocation" NOT NULL DEFAULT 'CUSTOMER_PICK_UP',
    "estimated_min_amount" INTEGER NOT NULL DEFAULT 0,
    "estimated_max_amount" INTEGER NOT NULL DEFAULT 0,
    "final_amount" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_options" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "catalog_option_group_id" TEXT NOT NULL,
    "catalog_option_id" TEXT NOT NULL,
    "group_code_snapshot" TEXT NOT NULL,
    "option_code_snapshot" TEXT NOT NULL,
    "display_name_snapshot" TEXT NOT NULL,
    "input_value" TEXT,
    "quantity" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_inputs" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "input_code" TEXT NOT NULL,
    "input_value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_photos" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "photo_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_price_snapshots" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "order_item_option_id" TEXT,
    "price_type" "CatalogPriceType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "amount" INTEGER,
    "min_amount" INTEGER,
    "max_amount" INTEGER,
    "quantity" DECIMAL(10,2),
    "calculated_min_amount" INTEGER NOT NULL,
    "calculated_max_amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_items_code_key" ON "catalog_items"("code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_option_groups_catalog_item_id_code_key" ON "catalog_option_groups"("catalog_item_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_options_catalog_option_group_id_code_parent_option__key" ON "catalog_options"("catalog_option_group_id", "code", "parent_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_item_inputs_catalog_item_id_code_key" ON "catalog_item_inputs"("catalog_item_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "order_request_options_group_code_code_parent_option_id_key" ON "order_request_options"("group_code", "code", "parent_option_id");

-- AddForeignKey
ALTER TABLE "catalog_option_groups" ADD CONSTRAINT "catalog_option_groups_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_options" ADD CONSTRAINT "catalog_options_catalog_option_group_id_fkey" FOREIGN KEY ("catalog_option_group_id") REFERENCES "catalog_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_options" ADD CONSTRAINT "catalog_options_parent_option_id_fkey" FOREIGN KEY ("parent_option_id") REFERENCES "catalog_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_option_prices" ADD CONSTRAINT "catalog_option_prices_catalog_option_id_fkey" FOREIGN KEY ("catalog_option_id") REFERENCES "catalog_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_option_rules" ADD CONSTRAINT "catalog_option_rules_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_option_rules" ADD CONSTRAINT "catalog_option_rules_catalog_option_group_id_fkey" FOREIGN KEY ("catalog_option_group_id") REFERENCES "catalog_option_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_option_rules" ADD CONSTRAINT "catalog_option_rules_catalog_option_id_fkey" FOREIGN KEY ("catalog_option_id") REFERENCES "catalog_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item_inputs" ADD CONSTRAINT "catalog_item_inputs_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_request_options" ADD CONSTRAINT "order_request_options_parent_option_id_fkey" FOREIGN KEY ("parent_option_id") REFERENCES "order_request_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "catalog_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_catalog_option_group_id_fkey" FOREIGN KEY ("catalog_option_group_id") REFERENCES "catalog_option_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_options" ADD CONSTRAINT "order_item_options_catalog_option_id_fkey" FOREIGN KEY ("catalog_option_id") REFERENCES "catalog_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_inputs" ADD CONSTRAINT "order_item_inputs_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_photos" ADD CONSTRAINT "order_item_photos_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_price_snapshots" ADD CONSTRAINT "order_item_price_snapshots_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_price_snapshots" ADD CONSTRAINT "order_item_price_snapshots_order_item_option_id_fkey" FOREIGN KEY ("order_item_option_id") REFERENCES "order_item_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
