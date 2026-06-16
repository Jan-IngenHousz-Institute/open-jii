CREATE TABLE "iot_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thing_name" text NOT NULL,
	"serial_number" text NOT NULL,
	"device_class" text NOT NULL,
	"certificate_id" text NOT NULL,
	"certificate_arn" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"owner_user_id" uuid,
	"provisioned_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"rotated_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "iot_devices_thing_name_unique" UNIQUE("thing_name"),
	CONSTRAINT "iot_devices_serial_number_unique" UNIQUE("serial_number"),
	CONSTRAINT "iot_devices_status_check" CHECK ("iot_devices"."status" IN ('active', 'rotating', 'revoked'))
);
--> statement-breakpoint
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;