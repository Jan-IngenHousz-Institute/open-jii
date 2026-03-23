-- Drop filename unique constraint (version is now part of the uniqueness)
ALTER TABLE "macros" DROP CONSTRAINT "macros_filename_unique";--> statement-breakpoint

-- Drop existing FKs that reference old single-column PKs
ALTER TABLE "experiment_protocols" DROP CONSTRAINT "experiment_protocols_protocol_id_protocols_id_fk";--> statement-breakpoint
ALTER TABLE "protocol_macros" DROP CONSTRAINT "protocol_macros_protocol_id_protocols_id_fk";--> statement-breakpoint
ALTER TABLE "protocol_macros" DROP CONSTRAINT "protocol_macros_macro_id_macros_id_fk";--> statement-breakpoint

-- Drop existing composite PKs on junction tables
ALTER TABLE "experiment_protocols" DROP CONSTRAINT "experiment_protocols_experiment_id_protocol_id_pk";--> statement-breakpoint
ALTER TABLE "protocol_macros" DROP CONSTRAINT "protocol_macros_protocol_id_macro_id_pk";--> statement-breakpoint

-- Drop old single-column PKs on main tables
ALTER TABLE "macros" DROP CONSTRAINT "macros_pkey";--> statement-breakpoint
ALTER TABLE "protocols" DROP CONSTRAINT "protocols_pkey";--> statement-breakpoint

-- Add version columns to junction tables (backfill existing rows to version 1)
ALTER TABLE "experiment_protocols" ADD COLUMN "protocol_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "protocol_macros" ADD COLUMN "protocol_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "protocol_macros" ADD COLUMN "macro_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint

-- Add composite PKs on main tables
ALTER TABLE "macros" ADD CONSTRAINT "macros_id_version_pk" PRIMARY KEY("id","version");--> statement-breakpoint
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_id_version_pk" PRIMARY KEY("id","version");--> statement-breakpoint

-- Add composite PKs on junction tables
ALTER TABLE "experiment_protocols" ADD CONSTRAINT "experiment_protocols_experiment_id_protocol_id_protocol_version_pk" PRIMARY KEY("experiment_id","protocol_id","protocol_version");--> statement-breakpoint
ALTER TABLE "protocol_macros" ADD CONSTRAINT "protocol_macros_protocol_id_protocol_version_macro_id_macro_version_pk" PRIMARY KEY("protocol_id","protocol_version","macro_id","macro_version");--> statement-breakpoint

-- Add composite FKs
ALTER TABLE "experiment_protocols" ADD CONSTRAINT "experiment_protocols_protocol_id_protocol_version_protocols_id_version_fk" FOREIGN KEY ("protocol_id","protocol_version") REFERENCES "public"."protocols"("id","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_macros" ADD CONSTRAINT "protocol_macros_protocol_id_protocol_version_protocols_id_version_fk" FOREIGN KEY ("protocol_id","protocol_version") REFERENCES "public"."protocols"("id","version") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_macros" ADD CONSTRAINT "protocol_macros_macro_id_macro_version_macros_id_version_fk" FOREIGN KEY ("macro_id","macro_version") REFERENCES "public"."macros"("id","version") ON DELETE cascade ON UPDATE no action;