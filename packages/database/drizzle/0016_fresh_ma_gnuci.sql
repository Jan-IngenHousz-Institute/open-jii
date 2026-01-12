ALTER TABLE "authenticators" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "authenticators" CASCADE;--> statement-breakpoint
ALTER TABLE "verification_tokens" RENAME TO "verifications";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "providerAccountId" TO "accountId";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "provider" TO "providerId";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "access_token" TO "accessToken";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "refresh_token" TO "refreshToken";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "id_token" TO "idToken";--> statement-breakpoint
ALTER TABLE "accounts" RENAME COLUMN "expires_at" TO "accessTokenExpiresAt";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "expires" TO "expiresAt";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "sessionToken" TO "token";--> statement-breakpoint
ALTER TABLE "verifications" RENAME COLUMN "token" TO "value";--> statement-breakpoint
ALTER TABLE "verifications" RENAME COLUMN "expires" TO "expiresAt";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "emailVerified" SET DATA TYPE boolean USING (CASE WHEN "emailVerified" IS NULL THEN false ELSE true END);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "emailVerified" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "refreshTokenExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "password" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_pkey";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ipAddress" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "userAgent" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "verifications" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "token_type";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "session_state";--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_unique" UNIQUE("token");