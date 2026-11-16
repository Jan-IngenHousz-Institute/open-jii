ALTER TYPE "public"."experiment_data_record_type" ADD VALUE 'contributor';--> statement-breakpoint
ALTER TYPE "public"."experiment_data_record_type" ADD VALUE 'device';--> statement-breakpoint
ALTER TABLE "experiment_data_outbox" ALTER COLUMN "experiment_id" DROP NOT NULL;