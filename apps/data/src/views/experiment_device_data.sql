WITH
-- Each device's latest attributes from the pipeline, with its measurement count
-- taken when someone reads. A count cannot be kept incrementally on classic
-- compute, and gold carries no firmware, so the count reads silver's
-- experiment, device and firmware columns for the experiment asked for.
-- ${catalog} is filled in by terraform.
-- Inside the WITH because Unity Catalog drops comments above a view's first keyword.
measurement_counts AS (
  SELECT experiment_id, device_id, device_firmware, count(*) AS total_measurements
  FROM ${catalog}.centrum.clean_data
  WHERE experiment_id IS NOT NULL
  GROUP BY experiment_id, device_id, device_firmware
)
SELECT
  devices.id,
  devices.experiment_id,
  devices.device_id,
  devices.client_id,
  devices.device_firmware,
  devices.device_name,
  devices.device_version,
  devices.device_battery,
  measurement_counts.total_measurements,
  devices.processed_timestamp,
  devices.device
FROM ${catalog}.centrum.experiment_device_data AS devices
LEFT JOIN measurement_counts
  ON devices.experiment_id = measurement_counts.experiment_id
  AND devices.device_id <=> measurement_counts.device_id
  AND devices.device_firmware <=> measurement_counts.device_firmware
