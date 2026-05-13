-- CreateTable
CREATE TABLE "route_resolution_rules" (
    "id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "is_premium" BOOLEAN,
    "has_repair" BOOLEAN,
    "route_code" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_resolution_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_resolution_rules_item_code_priority_idx" ON "route_resolution_rules"("item_code", "priority");
