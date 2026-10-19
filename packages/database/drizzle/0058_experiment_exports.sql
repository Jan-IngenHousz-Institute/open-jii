CREATE TYPE "public"."experiment_export_error_code" AS ENUM('no_data', 'too_many_rows_for_format', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."experiment_export_format" AS ENUM('csv', 'ndjson', 'json-array', 'parquet', 'xlsx');--> statement-breakpoint
CREATE TYPE "public"."experiment_export_status" AS ENUM('queued', 'pending', 'running', 'completed', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "experiment_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"table_name" text NOT NULL,
	"format" "experiment_export_format" NOT NULL,
	"anonymize_contributors" boolean NOT NULL,
	"status" "experiment_export_status" DEFAULT 'queued' NOT NULL,
	"job_run_id" bigint,
	"row_count" bigint,
	"total_bytes" bigint,
	"parts" jsonb,
	"error_code" "experiment_export_error_code",
	"created_by" uuid NOT NULL,
	"watcher_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiment_exports" ADD CONSTRAINT "experiment_exports_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_exports" ADD CONSTRAINT "experiment_exports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiment_exports_table_idx" ON "experiment_exports" USING btree ("experiment_id","table_name","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_exports_in_flight_uniq" ON "experiment_exports" USING btree ("experiment_id","table_name","format","anonymize_contributors") WHERE "experiment_exports"."status" IN ('queued', 'pending', 'running');--> statement-breakpoint
CREATE INDEX "experiment_exports_in_flight_idx" ON "experiment_exports" USING btree ("status") WHERE "experiment_exports"."status" IN ('queued', 'pending', 'running');