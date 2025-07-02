CREATE TYPE "public"."sensor_family" AS ENUM('multispeq', 'ambit');--> statement-breakpoint
CREATE TABLE "protocols" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"code" jsonb NOT NULL,
	"family" "sensor_family" NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "protocols_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "sensors" ADD COLUMN "family" "sensor_family" NOT NULL;--> statement-breakpoint
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;