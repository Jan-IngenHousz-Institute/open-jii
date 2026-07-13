ALTER TABLE "macros" ADD COLUMN "forked_from" uuid;--> statement-breakpoint
ALTER TABLE "protocols" ADD COLUMN "forked_from" uuid;--> statement-breakpoint
ALTER TABLE "workbooks" ADD COLUMN "forked_from" uuid;--> statement-breakpoint
ALTER TABLE "macros" ADD CONSTRAINT "macros_forked_from_macros_id_fk" FOREIGN KEY ("forked_from") REFERENCES "public"."macros"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_forked_from_protocols_id_fk" FOREIGN KEY ("forked_from") REFERENCES "public"."protocols"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workbooks" ADD CONSTRAINT "workbooks_forked_from_workbooks_id_fk" FOREIGN KEY ("forked_from") REFERENCES "public"."workbooks"("id") ON DELETE set null ON UPDATE no action;