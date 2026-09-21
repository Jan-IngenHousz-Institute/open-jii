CREATE TABLE "assistant_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"message_id" uuid,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"source" jsonb,
	"created_entity" jsonb,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "assistant_drafts_kind_check" CHECK ("assistant_drafts"."kind" IN ('experiment', 'protocol', 'workbook')),
	CONSTRAINT "assistant_drafts_status_check" CHECK ("assistant_drafts"."status" IN ('pending', 'confirmed', 'discarded'))
);
--> statement-breakpoint
CREATE TABLE "assistant_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"client_request_id" uuid,
	"rating" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "assistant_messages_role_check" CHECK ("assistant_messages"."role" IN ('user', 'assistant')),
	CONSTRAINT "assistant_messages_rating_check" CHECK ("assistant_messages"."rating" IS NULL OR "assistant_messages"."rating" IN ('up', 'down'))
);
--> statement-breakpoint
CREATE TABLE "assistant_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_starter_collection_items" (
	"collection_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "assistant_starter_collection_items_collection_id_resource_type_resource_id_pk" PRIMARY KEY("collection_id","resource_type","resource_id"),
	CONSTRAINT "assistant_starter_items_type_check" CHECK ("assistant_starter_collection_items"."resource_type" IN ('experiment', 'protocol', 'workbook'))
);
--> statement-breakpoint
CREATE TABLE "assistant_starter_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_starter_copies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"created_type" text NOT NULL,
	"created_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "assistant_starter_copies_source_type_check" CHECK ("assistant_starter_copies"."source_type" IN ('experiment', 'protocol', 'workbook')),
	CONSTRAINT "assistant_starter_copies_created_type_check" CHECK ("assistant_starter_copies"."created_type" IN ('experiment', 'protocol', 'workbook'))
);
--> statement-breakpoint
CREATE TABLE "assistant_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"context" jsonb,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assistant_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"thread_id" uuid,
	"organization_id" uuid,
	"event_type" text NOT NULL,
	"entity_type" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_drafts" ADD CONSTRAINT "assistant_drafts_thread_id_assistant_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_drafts" ADD CONSTRAINT "assistant_drafts_message_id_assistant_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."assistant_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_drafts" ADD CONSTRAINT "assistant_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_thread_id_assistant_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_settings" ADD CONSTRAINT "assistant_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_starter_collection_items" ADD CONSTRAINT "assistant_starter_collection_items_collection_id_assistant_starter_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."assistant_starter_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_starter_collections" ADD CONSTRAINT "assistant_starter_collections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_starter_copies" ADD CONSTRAINT "assistant_starter_copies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_starter_copies" ADD CONSTRAINT "assistant_starter_copies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_usage_events" ADD CONSTRAINT "assistant_usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_usage_events" ADD CONSTRAINT "assistant_usage_events_thread_id_assistant_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."assistant_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_usage_events" ADD CONSTRAINT "assistant_usage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistant_drafts_user_status_idx" ON "assistant_drafts" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "assistant_drafts_thread_idx" ON "assistant_drafts" USING btree ("thread_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_messages_thread_client_request_uniq" ON "assistant_messages" USING btree ("thread_id","client_request_id") WHERE "assistant_messages"."client_request_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "assistant_messages_thread_created_idx" ON "assistant_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_starter_items_resource_idx" ON "assistant_starter_collection_items" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_starter_collections_name_uniq" ON "assistant_starter_collections" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_starter_copies_created_uniq" ON "assistant_starter_copies" USING btree ("created_type","created_id");--> statement-breakpoint
CREATE INDEX "assistant_starter_copies_source_idx" ON "assistant_starter_copies" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "assistant_threads_user_updated_idx" ON "assistant_threads" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "assistant_usage_events_user_created_idx" ON "assistant_usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_usage_events_type_created_idx" ON "assistant_usage_events" USING btree ("event_type","created_at");
