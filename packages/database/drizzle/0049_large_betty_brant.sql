CREATE TYPE "public"."calibration_input_source" AS ENUM('bench_wizard', 'external_bench');--> statement-breakpoint
CREATE TYPE "public"."calibration_run_status" AS ENUM('running', 'computed', 'compute_failed', 'error', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "calibration_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family" "sensor_family" NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"capture_procedure" jsonb NOT NULL,
	"script" text NOT NULL,
	"output_schema" jsonb NOT NULL,
	"min_firmware_version" varchar(32),
	"organization_id" uuid,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "calibration_definitions_name_version_uniq" UNIQUE("name","version")
);
--> statement-breakpoint
CREATE TABLE "calibration_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"definition_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"input_source" "calibration_input_source" NOT NULL,
	"status" "calibration_run_status" DEFAULT 'running' NOT NULL,
	"payload" jsonb,
	"payload_s3_key" varchar(512),
	"params" jsonb,
	"blocks" jsonb,
	"pre_info" jsonb,
	"post_info" jsonb,
	"firmware_version" varchar(64),
	"error_message" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_calibrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"blocks" jsonb NOT NULL,
	"approved_by" uuid NOT NULL,
	"valid_from" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"superseded_at" timestamp,
	"written_to_device_at" timestamp,
	"write_results" jsonb,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calibration_definitions" ADD CONSTRAINT "calibration_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_definitions" ADD CONSTRAINT "calibration_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_runs" ADD CONSTRAINT "calibration_runs_definition_id_calibration_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."calibration_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_runs" ADD CONSTRAINT "calibration_runs_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_runs" ADD CONSTRAINT "calibration_runs_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_runs" ADD CONSTRAINT "calibration_runs_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_calibrations" ADD CONSTRAINT "device_calibrations_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_calibrations" ADD CONSTRAINT "device_calibrations_run_id_calibration_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."calibration_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_calibrations" ADD CONSTRAINT "device_calibrations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calibration_definitions_family_idx" ON "calibration_definitions" USING btree ("family");--> statement-breakpoint
CREATE INDEX "calibration_definitions_organization_id_idx" ON "calibration_definitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "calibration_definitions_created_by_idx" ON "calibration_definitions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "calibration_runs_device_id_idx" ON "calibration_runs" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "calibration_runs_definition_id_idx" ON "calibration_runs" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "calibration_runs_status_idx" ON "calibration_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "device_calibrations_active_uniq" ON "device_calibrations" USING btree ("device_id") WHERE "device_calibrations"."superseded_at" IS NULL;--> statement-breakpoint
CREATE INDEX "device_calibrations_run_id_idx" ON "device_calibrations" USING btree ("run_id");