-- Organizations join full-text search: name (A), description (B), location (C).
-- Hand-edited after `drizzle-kit generate`, as 0036 was — the GENERATED expression needs bare
-- column names (Postgres rejects table-qualified ones) and drizzle-kit cannot serialise
-- gin_trgm_ops, so the indexes live here and the snapshot does not track them.
-- The `type` enum is matched at query time: enum->text casts are not immutable.
ALTER TABLE "organizations" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("name", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '')), 'B') || setweight(to_tsvector('english', coalesce("location", '')), 'C')) STORED;--> statement-breakpoint
CREATE INDEX "organizations_search_vector_idx" ON "organizations" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "organizations_name_trgm_idx" ON "organizations" USING gin ("name" gin_trgm_ops);
