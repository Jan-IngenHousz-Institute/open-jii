CREATE TABLE "experiment_devices" (
	"experiment_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'UTC') NOT NULL,
	CONSTRAINT "experiment_devices_experiment_id_device_id_pk" PRIMARY KEY("experiment_id","device_id")
);
--> statement-breakpoint
ALTER TABLE "experiment_devices" ADD CONSTRAINT "experiment_devices_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_devices" ADD CONSTRAINT "experiment_devices_device_id_iot_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."iot_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_devices" ADD CONSTRAINT "experiment_devices_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiment_devices_device_idx" ON "experiment_devices" USING btree ("device_id");