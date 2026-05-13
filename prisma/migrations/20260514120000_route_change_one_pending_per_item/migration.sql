-- Enforces "at most one PENDING route_change_request per order_item" at the
-- DB level — closing the read-then-write race in
-- RequestRouteChangeUseCase. RESOLVED rows (APPROVED / REJECTED) are
-- excluded from the index so historical resolved rows do not constrain new
-- ones.
--
-- The application catches the P2002 raised on a concurrent collision via
-- `mapUniqueConflict` and rethrows `PendingRouteChangeExistsError`.

CREATE UNIQUE INDEX "route_change_requests_one_pending_per_item"
  ON "route_change_requests" ("order_item_id")
  WHERE status = 'PENDING';
