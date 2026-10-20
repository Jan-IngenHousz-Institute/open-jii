CREATE TYPE "public"."experiment_upload_error_code" AS ENUM('no_files', 'no_rows', 'not_queryable', 'transfer_interrupted', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."experiment_upload_source_kind" AS ENUM('ambyte', 'csv', 'tsv', 'parquet', 'json', 'ndjson');--> statement-breakpoint
CREATE TYPE "public"."experiment_upload_status" AS ENUM('receiving', 'queued', 'pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."experiment_upload_target_kind" AS ENUM('new', 'existing');--> statement-breakpoint
CREATE TABLE "experiment_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"upload_table_id" uuid,
	"upload_table_name" text,
	"target_kind" "experiment_upload_target_kind",
	"upload_directory" text,
	"source_kind" "experiment_upload_source_kind" NOT NULL,
	"status" "experiment_upload_status" DEFAULT 'receiving' NOT NULL,
	"job_run_id" bigint,
	"file_count" integer,
	"row_count" bigint,
	"rejected_files" jsonb,
	"error_code" "experiment_upload_error_code",
	"created_by" uuid NOT NULL,
	"completed_at" timestamp,
	"announced_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiment_uploads" ADD CONSTRAINT "experiment_uploads_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_uploads" ADD CONSTRAINT "experiment_uploads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiment_uploads_experiment_idx" ON "experiment_uploads" USING btree ("experiment_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_uploads_new_table_uniq" ON "experiment_uploads" USING btree ("experiment_id","upload_table_name") WHERE "experiment_uploads"."target_kind" = 'new' AND "experiment_uploads"."status" IN ('receiving', 'queued', 'pending', 'running');--> statement-breakpoint
CREATE INDEX "experiment_uploads_in_flight_idx" ON "experiment_uploads" USING btree ("status") WHERE "experiment_uploads"."status" IN ('receiving', 'queued', 'pending', 'running');--> statement-breakpoint
-- Failed-upload notifications stored the table name under fileName before it became tableName.
UPDATE "notifications" SET "params" = ("params" - 'fileName') || jsonb_build_object('tableName', "params"->>'fileName') WHERE "type" = 'data_upload_failed' AND "params" ? 'fileName';
