ALTER TYPE "public"."sensor_family" ADD VALUE 'generic';--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "status" SET DEFAULT 'active'::text;--> statement-breakpoint
DROP TYPE "public"."experiment_status";--> statement-breakpoint
CREATE TYPE "public"."experiment_status" AS ENUM('active', 'stale', 'archived', 'published');--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."experiment_status";--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "status" SET DATA TYPE "public"."experiment_status" USING "status"::"public"."experiment_status";