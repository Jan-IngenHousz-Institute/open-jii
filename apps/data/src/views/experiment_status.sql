WITH
-- Each experiment's newest processed row and whether it arrived within the last
-- hour, taken when someone reads, so status_updated_at is the time of the read. Gold
-- holds silver's rows that belong to an experiment and is clustered by experiment.
-- ${catalog} is filled in by terraform.
-- Inside the WITH because Unity Catalog drops comments above a view's first keyword.
latest AS (
  SELECT experiment_id, max(processed_timestamp) AS latest_processed_timestamp
  FROM ${catalog}.centrum.experiment_raw_data
  GROUP BY experiment_id
)
SELECT
  experiment_id,
  latest_processed_timestamp,
  CASE
    WHEN latest_processed_timestamp >= current_timestamp() - INTERVAL 60 MINUTES THEN 'fresh'
    ELSE 'stale'
  END AS status,
  current_timestamp() AS status_updated_at
FROM latest
