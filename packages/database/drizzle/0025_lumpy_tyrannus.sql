CREATE TABLE "workbook_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workbook_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"cells" jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"created_by" uuid NOT NULL,
	CONSTRAINT "workbook_versions_workbook_version_uniq" UNIQUE("workbook_id","version")
);
--> statement-breakpoint
CREATE TABLE "workbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"cells" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiment_protocols" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "experiment_protocols" CASCADE;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "workbook_id" uuid;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "workbook_version_id" uuid;--> statement-breakpoint
ALTER TABLE "workbook_versions" ADD CONSTRAINT "workbook_versions_workbook_id_workbooks_id_fk" FOREIGN KEY ("workbook_id") REFERENCES "public"."workbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbook_versions" ADD CONSTRAINT "workbook_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbooks" ADD CONSTRAINT "workbooks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workbook_versions_workbook_id_idx" ON "workbook_versions" USING btree ("workbook_id");--> statement-breakpoint
CREATE INDEX "workbooks_created_by_idx" ON "workbooks" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_workbook_id_workbooks_id_fk" FOREIGN KEY ("workbook_id") REFERENCES "public"."workbooks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_workbook_version_id_workbook_versions_id_fk" FOREIGN KEY ("workbook_version_id") REFERENCES "public"."workbook_versions"("id") ON DELETE set null ON UPDATE no action;