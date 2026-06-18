ALTER TABLE "sensors" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "sensors" ADD COLUMN "visibility" "visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;