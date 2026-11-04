WITH
-- Each device's newest attributes and its measurement count per experiment and
-- firmware, taken when someone reads, with its registry-resolved device struct. The
-- newest row wins by processing time, then measurement time, then id. Silver, since
-- gold carries firmware, battery and version only on rows written after it gained them;
-- a read scans silver's columns for the experiment asked for. ${catalog} is filled in by
-- terraform. A capture that arrived more than once keeps its id and time, so it counts once.
-- Inside the WITH because Unity Catalog drops comments above a view's first keyword.
devices AS (
  SELECT
    experiment_id,
    device_id,
    device_firmware,
    max_by(
      named_struct('device_name', device_name, 'device_version', device_version,
        'device_battery', device_battery, 'client_id', client_id,
        'fallback_device_name', coalesce(nullif(trim(device_name), ''), nullif(trim(client_id), ''), nullif(trim(device_id), '')),
        'fallback_device_id', coalesce(nullif(trim(device_id), ''), nullif(trim(client_id), '')),
        'processed_timestamp', processed_timestamp),
      named_struct('processed_timestamp', processed_timestamp, 'timestamp', `timestamp`, 'id', id)
    ) AS newest,
    count(DISTINCT id, `timestamp`) AS total_measurements
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
  registry.device,
  CASE
    WHEN nullif(trim(registry.device.serial_number), '') IS NOT NULL THEN registry.device.serial_number
    WHEN devices.newest.fallback_device_name = devices.newest.fallback_device_id THEN devices.newest.fallback_device_name
    WHEN devices.newest.fallback_device_id IS NOT NULL THEN concat(devices.newest.fallback_device_name, ' (', devices.newest.fallback_device_id, ')')
    ELSE coalesce(devices.newest.fallback_device_name, 'Unknown device')
  END AS device_label
FROM devices
LEFT JOIN ${catalog}.centrum.experiment_devices AS registry
  ON devices.experiment_id = registry.experiment_id
  AND devices.newest.client_id = registry.client_id
