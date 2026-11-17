CREATE TYPE "public"."experiment_data_destination" AS ENUM('lakehouse');--> statement-breakpoint
CREATE TYPE "public"."experiment_data_record_type" AS ENUM('annotation', 'metadata_sheet');--> statement-breakpoint
CREATE TABLE "experiment_data_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_type" "experiment_data_record_type" NOT NULL,
	"record_id" uuid NOT NULL,
	"experiment_id" uuid NOT NULL,
	"destination" "experiment_data_destination" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"claimed_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_data_outbox_waiting_uniq" ON "experiment_data_outbox" USING btree ("record_type","record_id","destination") WHERE "experiment_data_outbox"."claimed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "experiment_data_outbox_due_idx" ON "experiment_data_outbox" USING btree ("next_attempt_at");