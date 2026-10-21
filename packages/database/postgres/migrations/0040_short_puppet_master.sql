CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" text DEFAULT 'default' NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"refill_interval" bigint,
	"refill_amount" integer,
	"last_refill_at" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_time_window" bigint,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"remaining" integer,
	"last_request" timestamp,
	"expires_at" timestamp,
	"permissions" text,
	"metadata" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" text,
	"aaguid" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_reference_id_users_id_fk" FOREIGN KEY ("reference_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_key_idx" ON "api_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "api_keys_reference_id_idx" ON "api_keys" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "api_keys_config_id_idx" ON "api_keys" USING btree ("config_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkeys_credential_id_uniq" ON "passkeys" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "passkeys_user_idx" ON "passkeys" USING btree ("user_id");