ALTER TABLE "team_members" ADD COLUMN "membership_key" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "member_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_membership_key_uniq" ON "team_members" USING btree ("membership_key");--> statement-breakpoint
UPDATE "teams" SET "member_count" = (SELECT count(*) FROM "team_members" WHERE "team_members"."team_id" = "teams"."id");
