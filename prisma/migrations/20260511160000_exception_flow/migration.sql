-- CreateTable
CREATE TABLE "exception_flow_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exception_flow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exception_flow_template_steps" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "step_type" TEXT NOT NULL,
    "offset" INTEGER NOT NULL,
    "display_name" TEXT NOT NULL,

    CONSTRAINT "exception_flow_template_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_issues" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "issue_type" TEXT NOT NULL,
    "note" TEXT,
    "raised_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "request_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "options" JSONB,
    "decision" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exception_flow_templates_code_key" ON "exception_flow_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "exception_flow_template_steps_template_id_offset_key" ON "exception_flow_template_steps"("template_id", "offset");

-- CreateIndex
CREATE INDEX "item_issues_order_item_id_created_at_idx" ON "item_issues"("order_item_id", "created_at");

-- CreateIndex
CREATE INDEX "approval_requests_order_item_id_status_idx" ON "approval_requests"("order_item_id", "status");

-- AddForeignKey
ALTER TABLE "exception_flow_template_steps" ADD CONSTRAINT "exception_flow_template_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "exception_flow_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_issues" ADD CONSTRAINT "item_issues_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
