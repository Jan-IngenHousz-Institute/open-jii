CREATE TYPE "public"."experiment_members_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('research_institute', 'non_profit', 'private_company', 'government_agency', 'university');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text,
	"timestamp" timestamp DEFAULT now(),
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "experiment_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid,
	"user_id" uuid,
	"role" "experiment_members_role" DEFAULT 'member',
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"description" text,
	"is_public" boolean DEFAULT false,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "organization_type" NOT NULL,
	"description" text,
	"website" varchar(255),
	"location" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"bio" text,
	"avatar_url" varchar(500),
	"user_id" uuid,
	"organization_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sensors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serial_number" varchar(100),
	"name" text,
	"location" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sensors_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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