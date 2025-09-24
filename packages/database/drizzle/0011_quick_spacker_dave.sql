CREATE TYPE "public"."chart_family" AS ENUM('basic', 'scientific', '3d', 'statistical');--> statement-breakpoint
CREATE TYPE "public"."chart_type" AS ENUM('line', 'scatter', 'bar', 'pie', 'area', 'dot-plot', 'bubble', 'lollipop', 'box-plot', 'histogram', 'violin-plot', 'error-bar', 'density-plot', 'ridge-plot', 'histogram-2d', 'scatter2density', 'spc-control-chart', 'heatmap', 'contour', 'carpet', 'ternary', 'parallel-coordinates', 'log-plot', 'wind-rose', 'radar', 'polar', 'correlation-matrix', 'alluvial');--> statement-breakpoint
CREATE TABLE "experiment_visualizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"experiment_id" uuid NOT NULL,
	"chart_family" chart_family NOT NULL,
	"chart_type" chart_type NOT NULL,
	"config" jsonb NOT NULL,
	"data_config" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiment_visualizations" ADD CONSTRAINT "experiment_visualizations_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_visualizations" ADD CONSTRAINT "experiment_visualizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;