SET LOCAL lock_timeout = '5s';--> statement-breakpoint
-- Generated expressions use bare column names. GIN and trigram indexes are maintained here
-- because drizzle-kit cannot serialize gin_trgm_ops; the snapshot does not track them.
ALTER TABLE "workbooks" drop column "search_vector";--> statement-breakpoint
ALTER TABLE "workbooks" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("name", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '')), 'B') || setweight(to_tsvector('english', left(regexp_replace((jsonb_path_query_array("cells", '$[*] ? (@.type == "markdown").content') || jsonb_path_query_array("cells", '$[*] ? (@.type == "question").question.text'))::text, '\\[nrtbf]', ' ', 'g'), 100000)), 'C')) STORED;--> statement-breakpoint
ALTER TABLE "experiment_dashboards" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', "name"), 'A')) STORED;--> statement-breakpoint
ALTER TABLE "experiment_visualizations" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', "name"), 'A')) STORED;--> statement-breakpoint
ALTER TABLE "iot_devices" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("name", '')), 'A') || setweight(to_tsvector('english', "serial_number"), 'B')) STORED;--> statement-breakpoint
CREATE INDEX "experiment_visualizations_experiment_id_idx" ON "experiment_visualizations" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "workbooks_search_vector_idx" ON "workbooks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "experiment_dashboards_search_vector_idx" ON "experiment_dashboards" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "experiment_visualizations_search_vector_idx" ON "experiment_visualizations" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "iot_devices_search_vector_idx" ON "iot_devices" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "experiment_dashboards_name_trgm_idx" ON "experiment_dashboards" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "experiment_visualizations_name_trgm_idx" ON "experiment_visualizations" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "iot_devices_serial_number_trgm_idx" ON "iot_devices" USING gin ("serial_number" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "iot_devices_name_trgm_idx" ON "iot_devices" USING gin ((coalesce("name", "serial_number")) gin_trgm_ops);
