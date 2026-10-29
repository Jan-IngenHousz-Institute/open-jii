ALTER TABLE "organization_invitations" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "passkeys" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "workbook_versions" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
-- Backfill legacy rows: existing rows would otherwise all get the migration-time
-- clock; for these never-yet-updated tables the creation time is the honest value.
UPDATE "organization_invitations" SET "updated_at" = "created_at";--> statement-breakpoint
UPDATE "organization_members" SET "updated_at" = "created_at";--> statement-breakpoint
UPDATE "passkeys" SET "updated_at" = "created_at";--> statement-breakpoint
UPDATE "team_members" SET "updated_at" = "created_at";--> statement-breakpoint
UPDATE "workbook_versions" SET "updated_at" = "created_at";