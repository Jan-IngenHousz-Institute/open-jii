-- Rename users to user and update columns
ALTER TABLE "users" RENAME TO "user";
ALTER TABLE "user" ALTER COLUMN "id" SET DATA TYPE text;
ALTER TABLE "user" ALTER COLUMN "emailVerified" TYPE boolean USING ("emailVerified" IS NOT NULL);
ALTER TABLE "user" ALTER COLUMN "emailVerified" SET DEFAULT false;
ALTER TABLE "user" ALTER COLUMN "emailVerified" SET NOT NULL;

-- Create new tables
CREATE TABLE "account" (
"id" text PRIMARY KEY NOT NULL,
"userId" text NOT NULL,
"accountId" text NOT NULL,
"providerId" text NOT NULL,
"accessToken" text,
"refreshToken" text,
"accessTokenExpiresAt" timestamp,
"refreshTokenExpiresAt" timestamp,
"scope" text,
"idToken" text,
"password" text,
"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);

CREATE TABLE "session" (
"id" text PRIMARY KEY NOT NULL,
"userId" text NOT NULL,
"token" text NOT NULL,
"expiresAt" timestamp NOT NULL,
"ipAddress" text,
"userAgent" text,
"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE TABLE "verification" (
"id" text PRIMARY KEY NOT NULL,
"identifier" text NOT NULL,
"value" text NOT NULL,
"expiresAt" timestamp NOT NULL,
"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL
);

-- Migrate accounts data
INSERT INTO "account" ("id", "userId", "accountId", "providerId", "accessToken", "refreshToken", "accessTokenExpiresAt", "scope", "idToken", "created_at", "updated_at")
SELECT
  gen_random_uuid()::text,
  "userId"::text,
  "providerAccountId",
  "provider",
  "access_token",
  "refresh_token",
  to_timestamp("expires_at"),
  "scope",
  "id_token",
  now(),
  now()
FROM "accounts";

-- Drop old tables
ALTER TABLE "accounts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_tokens" DISABLE ROW LEVEL SECURITY;
DROP TABLE "accounts" CASCADE;
DROP TABLE "sessions" CASCADE;
DROP TABLE "verification_tokens" CASCADE;

-- Update FKs and types for other tables
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_users_id_fk";
ALTER TABLE "authenticators" DROP CONSTRAINT "authenticators_userId_users_id_fk";
ALTER TABLE "experiment_members" DROP CONSTRAINT "experiment_members_user_id_users_id_fk";
ALTER TABLE "experiment_visualizations" DROP CONSTRAINT "experiment_visualizations_created_by_users_id_fk";
ALTER TABLE "experiments" DROP CONSTRAINT "experiments_created_by_users_id_fk";
ALTER TABLE "macros" DROP CONSTRAINT "macros_created_by_users_id_fk";
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_user_id_users_id_fk";
ALTER TABLE "protocols" DROP CONSTRAINT "protocols_created_by_users_id_fk";

ALTER TABLE "audit_logs" ALTER COLUMN "user_id" SET DATA TYPE text;
ALTER TABLE "authenticators" ALTER COLUMN "userId" SET DATA TYPE text;
ALTER TABLE "experiment_members" ALTER COLUMN "user_id" SET DATA TYPE text;
ALTER TABLE "experiment_visualizations" ALTER COLUMN "created_by" SET DATA TYPE text;
ALTER TABLE "experiments" ALTER COLUMN "created_by" SET DATA TYPE text;
ALTER TABLE "macros" ALTER COLUMN "created_by" SET DATA TYPE text;
ALTER TABLE "profiles" ALTER COLUMN "user_id" SET DATA TYPE text;
ALTER TABLE "protocols" ALTER COLUMN "created_by" SET DATA TYPE text;

-- Re-add constraints referencing "user"
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "experiment_members" ADD CONSTRAINT "experiment_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "experiment_visualizations" ADD CONSTRAINT "experiment_visualizations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "macros" ADD CONSTRAINT "macros_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
