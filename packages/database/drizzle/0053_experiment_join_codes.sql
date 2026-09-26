CREATE TABLE "experiment_join_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"code" varchar(8) NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiment_join_codes" ADD CONSTRAINT "experiment_join_codes_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_join_codes" ADD CONSTRAINT "experiment_join_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_join_codes_code_uniq" ON "experiment_join_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_join_codes_active_uniq" ON "experiment_join_codes" USING btree ("experiment_id") WHERE "experiment_join_codes"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "experiment_join_codes_experiment_idx" ON "experiment_join_codes" USING btree ("experiment_id");