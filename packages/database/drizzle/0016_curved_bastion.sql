ALTER TABLE "authenticators" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "authenticators" CASCADE;--> statement-breakpoint
ALTER TABLE "verification_tokens" RENAME TO "verifications";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "providerAccountId" TO "account_id";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "provider" TO "provider_id";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "expires_at" TO "access_token_expires_at";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "sessionToken" TO "token";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "expires" TO "expires_at";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "emailVerified" TO "email_verified";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" TYPE boolean USING ("email_verified" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "verifications" RENAME COLUMN "token" TO "value";--> statement-breakpoint
ALTER TABLE "verifications" RENAME COLUMN "expires" TO "expires_at";--> statement-breakpoint
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_userId_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "refresh_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "password" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_pkey";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "token_type";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "session_state";--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_unique" UNIQUE("token");
