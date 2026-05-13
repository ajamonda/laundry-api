-- Washing notices are now customer-selectable catalog options.
-- Fresh databases no longer create this table in the catalog migration; this keeps
-- already-migrated local databases aligned.
DROP TABLE IF EXISTS "catalog_warnings";
