ALTER TABLE "experiments" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "status" SET DEFAULT 'active'::text;--> statement-breakpoint
UPDATE "experiments" SET "status" = 'active' WHERE "status" IN ('provisioning', 'provisioning_failed');--> statement-breakpoint
DROP TYPE "public"."experiment_status";--> statement-breakpoint
CREATE TYPE "public"."experiment_status" AS ENUM('active', 'stale', 'archived', 'published');--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."experiment_status";--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "status" SET DATA TYPE "public"."experiment_status" USING "status"::"public"."experiment_status";