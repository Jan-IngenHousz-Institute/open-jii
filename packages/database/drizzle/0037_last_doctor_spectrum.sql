ALTER TABLE "sensors" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "sensors" CASCADE;--> statement-breakpoint
ALTER TABLE "iot_devices" ALTER COLUMN "device_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "protocols" ALTER COLUMN "family" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."sensor_family";--> statement-breakpoint
CREATE TYPE "public"."sensor_family" AS ENUM('multispeq', 'ambyte', 'minipar', 'generic');--> statement-breakpoint
ALTER TABLE "iot_devices" ALTER COLUMN "device_type" SET DATA TYPE "public"."sensor_family" USING (CASE "device_type" WHEN 'ambit' THEN 'ambyte' ELSE "device_type" END)::"public"."sensor_family";--> statement-breakpoint
ALTER TABLE "protocols" ALTER COLUMN "family" SET DATA TYPE "public"."sensor_family" USING (CASE "family" WHEN 'ambit' THEN 'ambyte' ELSE "family" END)::"public"."sensor_family";