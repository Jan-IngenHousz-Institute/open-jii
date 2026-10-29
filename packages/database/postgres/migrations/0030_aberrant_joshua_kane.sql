CREATE TABLE "experiment_dashboards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"layout" jsonb DEFAULT '{"columns":12,"rowHeight":80,"gap":16}'::jsonb NOT NULL,
	"widgets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiment_dashboards" ADD CONSTRAINT "experiment_dashboards_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_dashboards" ADD CONSTRAINT "experiment_dashboards_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiment_dashboards_experiment_id_idx" ON "experiment_dashboards" USING btree ("experiment_id");