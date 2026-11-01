-- Custom SQL migration file, put your code below! --
-- Who exported and who uploaded in a week, counted as distinct people. An export's watchers asked for
-- it too and received it, so they count beside whoever started it.
GRANT SELECT (created_by, watcher_ids, status, completed_at) ON TABLE "experiment_exports" TO metrics_publisher;
GRANT SELECT (created_by, status, completed_at) ON TABLE "experiment_uploads" TO metrics_publisher;
