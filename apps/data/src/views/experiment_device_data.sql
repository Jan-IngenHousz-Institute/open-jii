WITH
-- Each device's newest attributes and its measurement count per experiment and
-- firmware, taken when someone reads, with its registry-resolved device struct. The
-- newest row wins by processing time, then measurement time, then id. Silver, since
-- gold carries no firmware, battery or version; a read scans silver's columns for the
-- experiment asked for. ${catalog} is filled in by terraform.
-- Inside the WITH because Unity Catalog drops comments above a view's first keyword.
devices AS (
  SELECT
    experiment_id,
    device_id,
    device_firmware,
    max_by(
      named_struct('device_name', device_name, 'device_version', device_version,
        'device_battery', device_battery, 'client_id', client_id,
        'processed_timestamp', processed_timestamp),
      named_struct('processed_timestamp', processed_timestamp, 'timestamp', `timestamp`, 'id', id)
    ) AS newest,
    count(*) AS total_measurements
  FROM ${catalog}.centrum.clean_data
  WHERE experiment_id IS NOT NULL
  GROUP BY experiment_id, device_id, device_firmware
)
SELECT
  abs(hash(devices.experiment_id, devices.device_id, devices.device_firmware)) AS id,
  devices.experiment_id,
  devices.device_id,
  devices.newest.client_id,
  devices.device_firmware,
  devices.newest.device_name,
  devices.newest.device_version,
  devices.newest.device_battery,
  devices.total_measurements,
  devices.newest.processed_timestamp,
  registry.device
FROM devices
LEFT JOIN ${catalog}.centrum.experiment_devices AS registry
  ON devices.experiment_id = registry.experiment_id
  AND devices.newest.client_id = registry.client_id
