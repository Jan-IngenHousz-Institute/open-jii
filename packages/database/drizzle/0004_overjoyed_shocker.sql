CREATE TABLE "experiment_protocols" (
	"experiment_id" uuid NOT NULL,
	"protocol_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_protocols_experiment_id_protocol_id_pk" PRIMARY KEY("experiment_id","protocol_id")
);
--> statement-breakpoint
ALTER TABLE "experiment_protocols" ADD CONSTRAINT "experiment_protocols_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_protocols" ADD CONSTRAINT "experiment_protocols_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE no action ON UPDATE no action;