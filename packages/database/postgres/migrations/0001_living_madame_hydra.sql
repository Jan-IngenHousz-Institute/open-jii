ALTER TABLE "experiments" ALTER COLUMN "name" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_name_unique" UNIQUE("name");