CREATE TABLE "organization_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"message" varchar(250),
	"status" "join_request_status" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "role" SET DEFAULT 'viewer';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "visibility" "visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_join_requests_pending_uniq" ON "organization_join_requests" USING btree ("organization_id","user_id") WHERE "organization_join_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "organization_join_requests_organization_idx" ON "organization_join_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "experiments_organization_id_idx" ON "experiments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitations_email_status_idx" ON "invitations" USING btree ("email","status");--> statement-breakpoint
CREATE INDEX "macros_organization_id_idx" ON "macros" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_invitations_email_status_idx" ON "organization_invitations" USING btree ("email","status");--> statement-breakpoint
CREATE INDEX "protocols_organization_id_idx" ON "protocols" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workbooks_organization_id_idx" ON "workbooks" USING btree ("organization_id");--> statement-breakpoint
-- Grant-role rename, second release: the first one shipped the code that reads
-- `viewer` while still writing `member`, so no instance able to write the old
-- spelling is live by the time this runs.
--
-- Only these two columns carry a *grant* role. `organization_members.role` and
-- `organization_invitations.role` carry Better Auth *organization* roles, where
-- `member` is the correct, current name — they must not be rewritten here.
UPDATE "resource_grants" SET "role" = 'viewer' WHERE "role" = 'member';--> statement-breakpoint
UPDATE "invitations" SET "role" = 'viewer' WHERE "role" = 'member';
