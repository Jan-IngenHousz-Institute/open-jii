CREATE TYPE "public"."answer_type" AS ENUM('TEXT', 'SELECT', 'NUMBER', 'BOOLEAN');--> statement-breakpoint
CREATE TYPE "public"."step_type" AS ENUM('INSTRUCTION', 'QUESTION', 'MEASUREMENT', 'ANALYSIS');--> statement-breakpoint
CREATE TABLE "flow_step_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"source_step_id" uuid NOT NULL,
	"target_step_id" uuid NOT NULL,
	"type" varchar(50) DEFAULT 'default' NOT NULL,
	"animated" boolean DEFAULT false NOT NULL,
	"label" varchar(255),
	"condition" jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_connection" UNIQUE("source_step_id","target_step_id")
);
--> statement-breakpoint
CREATE TABLE "flow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"type" "step_type" NOT NULL,
	"title" varchar(255),
	"description" text,
	"media" jsonb,
	"position" jsonb,
	"size" jsonb,
	"is_start_node" boolean DEFAULT false NOT NULL,
	"is_end_node" boolean DEFAULT false NOT NULL,
	"step_specification" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "flow_id" uuid;--> statement-breakpoint
ALTER TABLE "flow_step_connections" ADD CONSTRAINT "flow_step_connections_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_step_connections" ADD CONSTRAINT "flow_step_connections_source_step_id_flow_steps_id_fk" FOREIGN KEY ("source_step_id") REFERENCES "public"."flow_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_step_connections" ADD CONSTRAINT "flow_step_connections_target_step_id_flow_steps_id_fk" FOREIGN KEY ("target_step_id") REFERENCES "public"."flow_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flow_steps" ADD CONSTRAINT "flow_steps_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flow_step_connections_flow_id_idx" ON "flow_step_connections" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "flow_step_connections_source_idx" ON "flow_step_connections" USING btree ("source_step_id");--> statement-breakpoint
CREATE INDEX "flow_step_connections_target_idx" ON "flow_step_connections" USING btree ("target_step_id");--> statement-breakpoint
CREATE INDEX "flow_steps_flow_id_idx" ON "flow_steps" USING btree ("flow_id");--> statement-breakpoint
CREATE INDEX "flow_steps_start_node_idx" ON "flow_steps" USING btree ("flow_id","is_start_node");--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE no action ON UPDATE no action;