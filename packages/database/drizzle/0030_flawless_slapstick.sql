CREATE TABLE "macro_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"macro_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"code" text NOT NULL,
	"language" "macro_language" NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "macro_versions_macro_version_uniq" UNIQUE("macro_id","version")
);
--> statement-breakpoint
CREATE TABLE "protocol_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"code" jsonb NOT NULL,
	"family" "sensor_family" NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "protocol_versions_protocol_version_uniq" UNIQUE("protocol_id","version")
);
--> statement-breakpoint
ALTER TABLE "macros" ADD COLUMN "latest_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "protocols" ADD COLUMN "latest_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "macro_versions" ADD CONSTRAINT "macro_versions_macro_id_macros_id_fk" FOREIGN KEY ("macro_id") REFERENCES "public"."macros"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "macro_versions" ADD CONSTRAINT "macro_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_versions" ADD CONSTRAINT "protocol_versions_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_versions" ADD CONSTRAINT "protocol_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "macro_versions_macro_id_idx" ON "macro_versions" USING btree ("macro_id");--> statement-breakpoint
CREATE INDEX "protocol_versions_protocol_id_idx" ON "protocol_versions" USING btree ("protocol_id");