ALTER TABLE "macros" DROP CONSTRAINT "macros_name_unique";--> statement-breakpoint
ALTER TABLE "protocols" DROP CONSTRAINT "protocols_name_unique";--> statement-breakpoint
ALTER TABLE "macros" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "protocols" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "macros" ADD CONSTRAINT "macros_name_version" UNIQUE("name","version");--> statement-breakpoint
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_name_version" UNIQUE("name","version");