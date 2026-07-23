CREATE TYPE "public"."grantee_type" AS ENUM('user', 'organization', 'team');--> statement-breakpoint
CREATE TYPE "public"."org_base_permission" AS ENUM('none', 'read', 'admin');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('experiment', 'macro', 'protocol', 'workbook', 'device');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'public');--> statement-breakpoint
CREATE TABLE "resource_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" "resource_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"grantee_type" "grantee_type" NOT NULL,
	"grantee_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "visibility" "visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "macros" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "macros" ADD COLUMN "visibility" "visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "base_permission" "org_base_permission" DEFAULT 'read' NOT NULL;--> statement-breakpoint
ALTER TABLE "protocols" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "protocols" ADD COLUMN "visibility" "visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "workbooks" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "workbooks" ADD COLUMN "visibility" "visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_grants" ADD CONSTRAINT "resource_grants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_grants_unique" ON "resource_grants" USING btree ("resource_type","resource_id","grantee_type","grantee_id");--> statement-breakpoint
CREATE INDEX "resource_grants_resource_idx" ON "resource_grants" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "resource_grants_grantee_idx" ON "resource_grants" USING btree ("grantee_type","grantee_id");--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "macros" ADD CONSTRAINT "macros_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbooks" ADD CONSTRAINT "workbooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "iot_devices_organization_id_idx" ON "iot_devices" USING btree ("organization_id");--> statement-breakpoint
-- ============================================================================
-- Data backfill: give every existing resource an owning organization and
-- per-resource grants, so access runs through the unified authorization model
-- (owning-org role -> resource_grants -> public-read). Folded into this
-- migration (rather than a hand-run script) so it happens automatically and
-- atomically on db:migrate in every environment.
--
-- Owners are resolved via the deterministic personal-org slug
-- `personal-<created_by>` provisioned in 0035. All statements are set-based and
-- idempotent (guarded by IS NULL / ON CONFLICT DO NOTHING), so a re-run is a
-- no-op. "Everyone can read macros/protocols" is preserved for free by the
-- visibility column default ('public'); devices default to 'private' (owner
-- only). A resource whose creator has no personal org (e.g. a user soft-deleted
-- before 0035) stays organization_id NULL; can() handles that safely and the
-- creator grant below still records their access.
-- ============================================================================
-- Experiments: own each experiment with its creator's personal org.
UPDATE "experiments" e
SET "organization_id" = o."id"
FROM "organizations" o
WHERE o."slug" = 'personal-' || e."created_by"::text
  AND e."organization_id" IS NULL;--> statement-breakpoint
-- Experiments keep experiment_members as the contributor layer: mirror every
-- membership into resource_grants (role preserved: admin->admin, member->member)
-- so the unified can() authorizes existing members (read + admin manage).
INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role")
SELECT 'experiment', em."experiment_id", 'user', em."user_id", em."role"::text
FROM "experiment_members" em
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Macros: own each macro with its creator's personal org, and grant the creator
-- an admin grant on it. The grant future-proofs creator access if the macro
-- later moves to a shared org (redundant today: the creator owns the personal org).
UPDATE "macros" m
SET "organization_id" = o."id"
FROM "organizations" o
WHERE o."slug" = 'personal-' || m."created_by"::text
  AND m."organization_id" IS NULL;--> statement-breakpoint
INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role", "created_by")
SELECT 'macro', m."id", 'user', m."created_by", 'admin', m."created_by"
FROM "macros" m
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Protocols: same as macros.
UPDATE "protocols" p
SET "organization_id" = o."id"
FROM "organizations" o
WHERE o."slug" = 'personal-' || p."created_by"::text
  AND p."organization_id" IS NULL;--> statement-breakpoint
INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role", "created_by")
SELECT 'protocol', p."id", 'user', p."created_by", 'admin', p."created_by"
FROM "protocols" p
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Workbooks: same as macros.
UPDATE "workbooks" w
SET "organization_id" = o."id"
FROM "organizations" o
WHERE o."slug" = 'personal-' || w."created_by"::text
  AND w."organization_id" IS NULL;--> statement-breakpoint
INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role", "created_by")
SELECT 'workbook', w."id", 'user', w."created_by", 'admin', w."created_by"
FROM "workbooks" w
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Devices: own each device with its creator's personal org and grant the creator
-- an admin grant. Devices default to private visibility (owner-only), so there
-- is no public-read to preserve.
UPDATE "iot_devices" d
SET "organization_id" = o."id"
FROM "organizations" o
WHERE o."slug" = 'personal-' || d."created_by"::text
  AND d."organization_id" IS NULL;--> statement-breakpoint
INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role", "created_by")
SELECT 'device', d."id", 'user', d."created_by", 'admin', d."created_by"
FROM "iot_devices" d
ON CONFLICT DO NOTHING;