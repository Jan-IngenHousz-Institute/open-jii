ALTER TYPE "public"."sensor_family" ADD VALUE 'co2dot' BEFORE 'mobile';--> statement-breakpoint
ALTER TABLE "iot_devices" ALTER COLUMN "thing_arn" DROP NOT NULL;