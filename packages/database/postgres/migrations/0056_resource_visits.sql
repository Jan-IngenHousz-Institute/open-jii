CREATE TABLE "resource_visits" (
	"user_id" uuid NOT NULL,
	"resource_type" "resource_type" NOT NULL,
	"resource_id" uuid NOT NULL,
	"visited_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "resource_visits_user_id_resource_type_resource_id_pk" PRIMARY KEY("user_id","resource_type","resource_id")
);
--> statement-breakpoint
ALTER TABLE "resource_visits" ADD CONSTRAINT "resource_visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_visits_user_visited_idx" ON "resource_visits" USING btree ("user_id","visited_at" DESC NULLS LAST);