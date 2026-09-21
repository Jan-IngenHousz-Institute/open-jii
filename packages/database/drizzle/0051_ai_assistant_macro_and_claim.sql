ALTER TABLE "assistant_drafts" DROP CONSTRAINT "assistant_drafts_kind_check";--> statement-breakpoint
ALTER TABLE "assistant_drafts" DROP CONSTRAINT "assistant_drafts_status_check";--> statement-breakpoint
ALTER TABLE "assistant_starter_collection_items" DROP CONSTRAINT "assistant_starter_items_type_check";--> statement-breakpoint
ALTER TABLE "assistant_starter_copies" DROP CONSTRAINT "assistant_starter_copies_source_type_check";--> statement-breakpoint
ALTER TABLE "assistant_starter_copies" DROP CONSTRAINT "assistant_starter_copies_created_type_check";--> statement-breakpoint
ALTER TABLE "assistant_drafts" ADD CONSTRAINT "assistant_drafts_kind_check" CHECK ("assistant_drafts"."kind" IN ('experiment', 'protocol', 'workbook', 'macro'));--> statement-breakpoint
ALTER TABLE "assistant_drafts" ADD CONSTRAINT "assistant_drafts_status_check" CHECK ("assistant_drafts"."status" IN ('pending', 'confirming', 'confirmed', 'discarded'));--> statement-breakpoint
ALTER TABLE "assistant_starter_collection_items" ADD CONSTRAINT "assistant_starter_items_type_check" CHECK ("assistant_starter_collection_items"."resource_type" IN ('experiment', 'protocol', 'workbook', 'macro'));--> statement-breakpoint
ALTER TABLE "assistant_starter_copies" ADD CONSTRAINT "assistant_starter_copies_source_type_check" CHECK ("assistant_starter_copies"."source_type" IN ('experiment', 'protocol', 'workbook', 'macro'));--> statement-breakpoint
ALTER TABLE "assistant_starter_copies" ADD CONSTRAINT "assistant_starter_copies_created_type_check" CHECK ("assistant_starter_copies"."created_type" IN ('experiment', 'protocol', 'workbook', 'macro'));