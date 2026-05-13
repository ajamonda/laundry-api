-- Idempotency key columns on billing_requests, with a partial-unique-via-NULL
-- semantic enforced by Postgres' default behaviour (NULLs distinct).
-- BASE rows leave both nullable columns NULL → no constraint pressure.
-- SUPPLEMENT rows populate both → at most one per (sourceType, sourceId).

ALTER TABLE "billing_requests" ADD COLUMN "source_type" TEXT;
ALTER TABLE "billing_requests" ADD COLUMN "source_id" TEXT;

CREATE UNIQUE INDEX "billing_requests_source_type_source_id_key"
  ON "billing_requests"("source_type", "source_id");
