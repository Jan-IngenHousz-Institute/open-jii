ALTER TYPE "public"."experiment_data_record_type" ADD VALUE 'contributor';--> statement-breakpoint
ALTER TYPE "public"."experiment_data_record_type" ADD VALUE 'device';--> statement-breakpoint
ALTER TABLE "experiment_data_outbox" ALTER COLUMN "experiment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "experiment_data_outbox" ADD CONSTRAINT "experiment_data_outbox_experiment_check" CHECK (("experiment_data_outbox"."experiment_id" IS NOT NULL) = ("experiment_data_outbox"."record_type" IN ('annotation', 'metadata_sheet')));