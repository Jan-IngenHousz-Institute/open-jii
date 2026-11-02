CREATE TABLE "experiment_question_types" (
	"experiment_id" uuid NOT NULL,
	"key" text NOT NULL,
	"declared_class" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"evidence" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "experiment_question_types_experiment_id_key_pk" PRIMARY KEY("experiment_id","key"),
	CONSTRAINT "experiment_question_types_class" CHECK ("experiment_question_types"."declared_class" IN ('number', 'text')),
	CONSTRAINT "experiment_question_types_active_number" CHECK (NOT "experiment_question_types"."active" OR "experiment_question_types"."declared_class" = 'number')
);
--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "question_types_tracked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "experiment_question_types" ADD CONSTRAINT "experiment_question_types_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;