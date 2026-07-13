ALTER TYPE "public"."device_status" ADD VALUE 'rotating' BEFORE 'revoked';--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "certificate_id" text;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "certificate_arn" text;