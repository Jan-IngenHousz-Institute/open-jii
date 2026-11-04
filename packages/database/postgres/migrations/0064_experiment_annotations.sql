CREATE TYPE "public"."annotation_type" AS ENUM('comment', 'flag');--> statement-breakpoint
CREATE TABLE "experiment_annotations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"experiment_id" uuid NOT NULL,
	"table_name" varchar(64) NOT NULL,
	"row_id" varchar(64) NOT NULL,
	"type" "annotation_type" NOT NULL,
	"content_text" text,
	"flag_type" varchar(100),
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiment_annotations" ADD CONSTRAINT "experiment_annotations_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiment_annotations_row_idx" ON "experiment_annotations" USING btree ("experiment_id","table_name","row_id");