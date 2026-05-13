-- Add READY_TO_PACKAGE step after INSPECTING in all 6 processing routes

INSERT INTO "processing_route_steps" ("id", "route_id", "step_type", "sort_order", "display_name", "created_at", "updated_at")
SELECT gen_random_uuid(), r.id, 'READY_TO_PACKAGE', 500, '포장 준비', now(), now()
FROM "processing_routes" r WHERE r.code = 'GENERAL_CLOTHES_CLEANING'
ON CONFLICT ("route_id", "step_type") DO NOTHING;

INSERT INTO "processing_route_steps" ("id", "route_id", "step_type", "sort_order", "display_name", "created_at", "updated_at")
SELECT gen_random_uuid(), r.id, 'READY_TO_PACKAGE', 600, '포장 준비', now(), now()
FROM "processing_routes" r WHERE r.code = 'REPAIR_AND_CLEANING'
ON CONFLICT ("route_id", "step_type") DO NOTHING;

INSERT INTO "processing_route_steps" ("id", "route_id", "step_type", "sort_order", "display_name", "created_at", "updated_at")
SELECT gen_random_uuid(), r.id, 'READY_TO_PACKAGE', 500, '포장 준비', now(), now()
FROM "processing_routes" r WHERE r.code = 'PREMIUM_CLEANING'
ON CONFLICT ("route_id", "step_type") DO NOTHING;

INSERT INTO "processing_route_steps" ("id", "route_id", "step_type", "sort_order", "display_name", "created_at", "updated_at")
SELECT gen_random_uuid(), r.id, 'READY_TO_PACKAGE', 500, '포장 준비', now(), now()
FROM "processing_routes" r WHERE r.code = 'OUTSOURCED_CLEANING'
ON CONFLICT ("route_id", "step_type") DO NOTHING;

INSERT INTO "processing_route_steps" ("id", "route_id", "step_type", "sort_order", "display_name", "created_at", "updated_at")
SELECT gen_random_uuid(), r.id, 'READY_TO_PACKAGE', 500, '포장 준비', now(), now()
FROM "processing_routes" r WHERE r.code = 'STANDARD_SHOES_CLEANING'
ON CONFLICT ("route_id", "step_type") DO NOTHING;

INSERT INTO "processing_route_steps" ("id", "route_id", "step_type", "sort_order", "display_name", "created_at", "updated_at")
SELECT gen_random_uuid(), r.id, 'READY_TO_PACKAGE', 400, '포장 준비', now(), now()
FROM "processing_routes" r WHERE r.code = 'QUICK_LAUNDRY'
ON CONFLICT ("route_id", "step_type") DO NOTHING;
