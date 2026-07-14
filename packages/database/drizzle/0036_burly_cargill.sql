-- Full-text search (tsvector + ts_rank) and fuzzy matching (pg_trgm).
-- NOTE: hand-edited after `drizzle-kit generate` — the GENERATED expressions use bare column
-- names (Postgres rejects table-qualified references in generation expressions) and the
-- extension + GIN/pg_trgm indexes are added here (drizzle-kit cannot serialise the gin_trgm_ops
-- operator class). The 0036 snapshot intentionally does not track these indexes.
-- Enum columns (macros.language, protocols.family) are matched at query time, not in the stored
-- vector, because enum->text casts are not immutable and cannot live in a generated column.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("name", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '')), 'B')) STORED;--> statement-breakpoint
ALTER TABLE "macros" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("name", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '')), 'B')) STORED;--> statement-breakpoint
ALTER TABLE "protocols" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("name", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '')), 'B')) STORED;--> statement-breakpoint
ALTER TABLE "workbooks" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("name", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '')), 'B')) STORED;--> statement-breakpoint
CREATE INDEX "experiments_search_vector_idx" ON "experiments" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "macros_search_vector_idx" ON "macros" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "protocols_search_vector_idx" ON "protocols" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "workbooks_search_vector_idx" ON "workbooks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "experiments_name_trgm_idx" ON "experiments" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "macros_name_trgm_idx" ON "macros" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "protocols_name_trgm_idx" ON "protocols" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "workbooks_name_trgm_idx" ON "workbooks" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "profiles_first_name_trgm_idx" ON "profiles" USING gin ("first_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "profiles_last_name_trgm_idx" ON "profiles" USING gin ("last_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "users_email_trgm_idx" ON "users" USING gin ("email" gin_trgm_ops);
