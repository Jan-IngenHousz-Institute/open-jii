CREATE TABLE "auth_rate_limit_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"route" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_rate_limit_counters_expiry_idx" ON "auth_rate_limit_counters" USING btree ("expires_at");