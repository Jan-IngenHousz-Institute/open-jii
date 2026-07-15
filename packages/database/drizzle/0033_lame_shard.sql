CREATE TYPE "public"."device_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TABLE "iot_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thing_name" text NOT NULL,
	"thing_arn" text NOT NULL,
	"serial_number" text NOT NULL,
	"name" varchar(255),
	"device_type" text NOT NULL,
	"status" "device_status" DEFAULT 'pending' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "iot_devices_thing_name_unique" UNIQUE("thing_name"),
	CONSTRAINT "iot_devices_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "iot_devices_created_by_idx" ON "iot_devices" USING btree ("created_by");