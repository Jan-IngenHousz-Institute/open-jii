-- Setup-progress vocabulary replaces the certificate-shaped one. Postgres cannot
-- drop an enum value, so the type is swapped: pending -> registered, rotating folds
-- into active (it only ever lived inside one request), retired is new.
CREATE TYPE "public"."device_status_v2" AS ENUM('registered', 'active', 'revoked', 'retired');--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "status_v2" "public"."device_status_v2" NOT NULL DEFAULT 'registered';--> statement-breakpoint
UPDATE "iot_devices" SET "status_v2" = CASE "status"::text
  WHEN 'pending' THEN 'registered'::"public"."device_status_v2"
  WHEN 'active' THEN 'active'::"public"."device_status_v2"
  WHEN 'rotating' THEN 'active'::"public"."device_status_v2"
  WHEN 'revoked' THEN 'revoked'::"public"."device_status_v2"
END;--> statement-breakpoint
ALTER TABLE "iot_devices" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "iot_devices" RENAME COLUMN "status_v2" TO "status";--> statement-breakpoint
DROP TYPE "public"."device_status";--> statement-breakpoint
ALTER TYPE "public"."device_status_v2" RENAME TO "device_status";
