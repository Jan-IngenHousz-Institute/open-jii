locals {
  # The system logs that ship without a TTL. opentelemetry_span_log defines its own engine and stays
  # empty unless tracing is on.
  system_log_tables = [
    "query_log", "trace_log", "query_thread_log", "query_views_log", "part_log", "text_log",
    "metric_log", "asynchronous_metric_log", "error_log", "query_metric_log", "crash_log",
    "backup_log", "s3queue_log",
  ]

  # The views that name an experiment (packages/database/clickhouse/migrations), which the reader
  # reads beside the three tables below, and the tables a reload replaces rows of or removes ids from.
  reader_views = [
    "experiment_measurements", "experiment_macro_results", "experiment_uploads",
    "experiment_contributor_ids", "experiment_client_ids", "experiment_payload_schemas",
    "experiment_metadata_rows", "experiment_metadata_sheets",
  ]
  reloaded_tables = ["measurements", "macro_results", "uploads", "payload_schemas", "contributor_ids", "client_ids"]

  # The tables under the experiment views, which a chart reads to name only the payload paths it
  # plots; through a view the store reads every payload whole. The reader's row policy on each keeps
  # a read to the experiment it sends as a setting, and fails a read that sends none.
  reader_tables     = ["measurements", "macro_results", "uploads"]
  reader_row_filter = "experiment_id = getSetting('custom_experiment')"

  # No grants means the admin, which manages access and applies the schema. The writer only inserts,
  # and keeps out of the migration ledger, which records what the schema already holds. The reloader
  # also deletes from the tables it reloads; a lightweight delete updates their rows' mask column,
  # which a grant can name only table by table. ALTER DELETE also allows dropping a partition, and
  # there is no narrower grant. The profiles are in templates/users.xml.tftpl.
  users = {
    admin = { name = "openjii_admin", profile = "default", grants = [], row_filters = {} }
    writer = {
      name    = "openjii_writer"
      profile = "ingest"
      grants = [
        "GRANT SELECT, INSERT ON store.*",
        "REVOKE INSERT ON store._migrations",
      ]
      row_filters = {}
    }
    reloader = {
      name    = "openjii_reloader"
      profile = "ingest"
      grants = concat(
        ["GRANT SELECT, INSERT ON store.*"],
        [for table in local.reloaded_tables : "GRANT ALTER DELETE, ALTER UPDATE(_row_exists) ON store.${table}"],
        ["REVOKE INSERT ON store._migrations"],
      )
      row_filters = {}
    }
    reader = {
      name    = "openjii_reader"
      profile = "reader"
      grants = concat(
        [for view in local.reader_views : "GRANT SELECT ON store.${view}"],
        [for table in local.reader_tables : "GRANT SELECT ON store.${table}"],
      )
      row_filters = { for table in local.reader_tables : table => local.reader_row_filter }
    }
  }
}
