# dlt-heartbeat

The Databricks heartbeat metrics file has not arrived: the metrics job, its schedule, or the write path is broken, or the workspace is unreachable. All OpenJII/Data metrics are blind while this fires.

Likely causes: job schedule paused/deleted (workspace change); job cluster failing to start; volume/storage permission change; bundle deploy removed the task.

First moves: Databricks job run history for metrics_heartbeat; if runs succeed but no alert recovery, check S3 event -> forwarder Lambda logs; AWS-native metrics remain trustworthy throughout.
