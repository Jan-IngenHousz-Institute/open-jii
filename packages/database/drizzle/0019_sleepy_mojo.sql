CREATE TYPE "public"."invitation_resource_type" AS ENUM('platform', 'experiment');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" "invitation_resource_type" NOT NULL,
	"resource_id" uuid,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "resource_id_check" CHECK (("invitations"."resource_type" = 'platform' AND "invitations"."resource_id" IS NULL) OR ("invitations"."resource_type" != 'platform' AND "invitations"."resource_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "status" SET DEFAULT 'active'::text;--> statement-breakpoint
DROP TYPE "public"."experiment_status";--> statement-breakpoint
CREATE TYPE "public"."experiment_status" AS ENUM('active', 'stale', 'archived', 'published');--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."experiment_status";--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "status" SET DATA TYPE "public"."experiment_status" USING "status"::"public"."experiment_status";--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;