ALTER TABLE "audit_logs" ALTER COLUMN "timestamp" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "experiment_members" ALTER COLUMN "joined_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "experiment_protocols" ALTER COLUMN "added_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "flows" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "flows" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "protocols" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "protocols" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "sensors" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'UTC');--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "sensors" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL;