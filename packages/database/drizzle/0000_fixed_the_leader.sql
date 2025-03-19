CREATE TYPE "public"."organization_type" AS ENUM('research_institute', 'non_profit', 'private_company', 'government_agency', 'university');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial NOT NULL,
	"user_id" integer,
	"action" text,
	"timestamp" timestamp DEFAULT now(),
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "experiment_members" (
	"id" serial NOT NULL,
	"experiment_id" integer,
	"user_id" integer,
	"role" varchar(50) DEFAULT 'member',
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"description" text,
	"is_public" boolean DEFAULT false,
	"created_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "organization_type" NOT NULL,
	"description" text,
	"website" varchar(255),
	"location" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"bio" text,
	"avatar_url" varchar(500),
	"user_id" integer,
	"organization_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sensors" (
	"id" serial PRIMARY KEY NOT NULL,
	"serial_number" varchar(100),
	"name" text,
	"location" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sensors_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_members" ADD CONSTRAINT "experiment_members_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_members" ADD CONSTRAINT "experiment_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;