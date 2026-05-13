-- CreateEnum
CREATE TYPE "ProcessingPlanStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ProcessingStepSource" AS ENUM ('ROUTE', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "ProcessingStepStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ItemProcessEventType" AS ENUM ('PLAN_CREATED', 'PLAN_SUPERSEDED', 'PLAN_COMPLETED', 'STEP_STARTED', 'STEP_COMPLETED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('CUSTOMER', 'STAFF');

-- CreateTable
CREATE TABLE "processing_routes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_route_steps" (
    "id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "step_type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processing_route_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_processing_plans" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "status" "ProcessingPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMP(3),

    CONSTRAINT "item_processing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_processing_states" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "current_step_source" "ProcessingStepSource" NOT NULL,
    "current_route_step_id" TEXT,
    "current_override_id" TEXT,
    "current_step_status" "ProcessingStepStatus" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_processing_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_process_events" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "event_type" "ItemProcessEventType" NOT NULL,
    "route_step_id" TEXT,
    "override_id" TEXT,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "staff_role" "StaffRole",
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_process_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" TEXT NOT NULL,
    "staff_role" "StaffRole",
    "action_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "reason" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processing_routes_code_key" ON "processing_routes"("code");

-- CreateIndex
CREATE INDEX "processing_route_steps_route_id_sort_order_idx" ON "processing_route_steps"("route_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "processing_route_steps_route_id_sort_order_key" ON "processing_route_steps"("route_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "processing_route_steps_route_id_step_type_key" ON "processing_route_steps"("route_id", "step_type");

-- CreateIndex
CREATE INDEX "item_processing_plans_order_item_id_status_idx" ON "item_processing_plans"("order_item_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "item_processing_states_order_item_id_key" ON "item_processing_states"("order_item_id");

-- CreateIndex
CREATE INDEX "item_process_events_order_item_id_created_at_idx" ON "item_process_events"("order_item_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_timestamp_idx" ON "audit_logs"("target_type", "target_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_timestamp_idx" ON "audit_logs"("actor_id", "timestamp");

-- AddForeignKey
ALTER TABLE "processing_route_steps" ADD CONSTRAINT "processing_route_steps_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "processing_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_processing_plans" ADD CONSTRAINT "item_processing_plans_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_processing_plans" ADD CONSTRAINT "item_processing_plans_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "processing_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_processing_states" ADD CONSTRAINT "item_processing_states_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_processing_states" ADD CONSTRAINT "item_processing_states_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "item_processing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_processing_states" ADD CONSTRAINT "item_processing_states_current_route_step_id_fkey" FOREIGN KEY ("current_route_step_id") REFERENCES "processing_route_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_process_events" ADD CONSTRAINT "item_process_events_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_process_events" ADD CONSTRAINT "item_process_events_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "item_processing_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_process_events" ADD CONSTRAINT "item_process_events_route_step_id_fkey" FOREIGN KEY ("route_step_id") REFERENCES "processing_route_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
