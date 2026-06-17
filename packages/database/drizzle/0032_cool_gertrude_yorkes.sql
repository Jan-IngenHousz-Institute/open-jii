CREATE TYPE "public"."grantee_type" AS ENUM('user', 'organization', 'team');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('experiment', 'macro', 'protocol', 'workbook', 'device');--> statement-breakpoint
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
ALTER TABLE "resource_grants" ADD CONSTRAINT "resource_grants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "resource_grants_unique" ON "resource_grants" USING btree ("resource_type","resource_id","grantee_type","grantee_id");--> statement-breakpoint
CREATE INDEX "resource_grants_resource_idx" ON "resource_grants" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "resource_grants_grantee_idx" ON "resource_grants" USING btree ("grantee_type","grantee_id");--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;