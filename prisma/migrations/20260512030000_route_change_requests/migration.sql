CREATE TABLE "route_change_requests" (
  "id"               TEXT NOT NULL,
  "order_item_id"    TEXT NOT NULL,
  "from_route_code"  TEXT NOT NULL,
  "to_route_code"    TEXT NOT NULL,
  "additional_cost"  INTEGER,
  "reason"           TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'PENDING',
  "requested_by"     TEXT NOT NULL,
  "responded_at"     TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "route_change_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "route_change_requests_order_item_id_fkey"
    FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "route_change_requests_order_item_id_status_idx"
  ON "route_change_requests"("order_item_id", "status");
