CREATE TYPE "public"."data_license" AS ENUM('CC0-1.0', 'CC-BY-4.0');--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "organism" varchar(255);--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "experimental_design" text;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "growth_facility" text;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "license" "data_license";