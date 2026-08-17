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
-- Backfill before the constraint: 0035's legacy cleanup deliberately kept a
-- slug-less organization that still had members, so this is a no-op everywhere it
-- matters and the only thing between that one row and a failed deploy.
UPDATE "organizations" SET "slug" = 'legacy-' || "id"::text WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
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
-- Grant-role rename, second release. Safe for two different reasons rather than one:
-- `resource_grants` has no live writer of the old spelling, because release 1 already
-- emits `viewer` there. `invitations.role` does still have one — release 1's invitation
-- insert writes `member`, and those instances are up during a rolling deploy — but a
-- row that lands after this UPDATE is read correctly anyway, since the reader maps
-- anything that is not `admin` to `viewer`.
--
-- Only these two columns carry a *grant* role. `organization_members.role` and
-- `organization_invitations.role` carry Better Auth *organization* roles, where
-- `member` is the correct, current name — they must not be rewritten here.
UPDATE "resource_grants" SET "role" = 'viewer' WHERE "role" = 'member';--> statement-breakpoint
UPDATE "invitations" SET "role" = 'viewer' WHERE "role" = 'member';