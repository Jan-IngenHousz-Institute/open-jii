CREATE TABLE "protocol_macros" (
	"protocol_id" uuid NOT NULL,
	"macro_id" uuid NOT NULL,
	"added_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "protocol_macros_protocol_id_macro_id_pk" PRIMARY KEY("protocol_id","macro_id")
);
--> statement-breakpoint
ALTER TABLE "protocol_macros" ADD CONSTRAINT "protocol_macros_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_macros" ADD CONSTRAINT "protocol_macros_macro_id_macros_id_fk" FOREIGN KEY ("macro_id") REFERENCES "public"."macros"("id") ON DELETE cascade ON UPDATE no action;