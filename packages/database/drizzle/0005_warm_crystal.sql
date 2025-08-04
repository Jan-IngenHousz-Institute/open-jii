ALTER TABLE "organizations" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "registered" boolean DEFAULT false NOT NULL;