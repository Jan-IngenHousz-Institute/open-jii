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
ALTER TABLE "experiments" DROP CONSTRAINT "experiments_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "macros" DROP CONSTRAINT "macros_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "protocols" DROP CONSTRAINT "protocols_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "workbooks" DROP CONSTRAINT "workbooks_organization_id_organizations_id_fk";
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
-- RESTRICT, replacing the CASCADE these four were created with: deleting an
-- organization is refused while it still owns work, and the count that produces that
-- friendly refusal runs before Better Auth's delete transaction opens — so a resource
-- transferred in after the count was destroyed along with the organization. The
-- constraint is what closes that window. `iot_devices` has been RESTRICT since 0039.
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "macros" ADD CONSTRAINT "macros_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbooks" ADD CONSTRAINT "workbooks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
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
-- `member` is the correct, current name — no rename reaches them. The sweep that
-- follows touches those two columns for an unrelated reason, and renames nothing.
UPDATE "resource_grants" SET "role" = 'viewer' WHERE "role" = 'member';--> statement-breakpoint
UPDATE "invitations" SET "role" = 'viewer' WHERE "role" = 'member';--> statement-breakpoint
-- Canonicalize the organization-role columns. Before this release's role guard, the
-- mounted Better Auth endpoints stored whatever they were handed — `"member, owner"`,
-- `" owner "` — and Better Auth's own last-owner guards exact-match `'owner'`, so a
-- comma-joined owner is invisible to them and an organization can be emptied of its
-- last one. Every openJII reader already collapses these values (owner > admin >
-- member); these statements make the stored value agree, in that same precedence.
--
-- Only non-canonical rows are touched. That is what makes the sweep re-runnable, and
-- what leaves a NULL invitation role — Better Auth's own "no role named", read as
-- `member` everywhere — exactly as it was, since `NULL NOT IN (…)` never matches. The
-- regex is the whitespace-tolerant form of "a comma-separated token that is this role".
UPDATE "organization_members" SET "role" = 'owner'
  WHERE "role" NOT IN ('owner', 'admin', 'member')
    AND "role" ~ '(^|,)[[:space:]]*owner[[:space:]]*($|,)';--> statement-breakpoint
UPDATE "organization_members" SET "role" = 'admin'
  WHERE "role" NOT IN ('owner', 'admin', 'member')
    AND "role" ~ '(^|,)[[:space:]]*admin[[:space:]]*($|,)';--> statement-breakpoint
UPDATE "organization_members" SET "role" = 'member'
  WHERE "role" NOT IN ('owner', 'admin', 'member');--> statement-breakpoint
UPDATE "organization_invitations" SET "role" = 'owner'
  WHERE "role" NOT IN ('owner', 'admin', 'member')
    AND "role" ~ '(^|,)[[:space:]]*owner[[:space:]]*($|,)';--> statement-breakpoint
UPDATE "organization_invitations" SET "role" = 'admin'
  WHERE "role" NOT IN ('owner', 'admin', 'member')
    AND "role" ~ '(^|,)[[:space:]]*admin[[:space:]]*($|,)';--> statement-breakpoint
UPDATE "organization_invitations" SET "role" = 'member'
  WHERE "role" NOT IN ('owner', 'admin', 'member');
