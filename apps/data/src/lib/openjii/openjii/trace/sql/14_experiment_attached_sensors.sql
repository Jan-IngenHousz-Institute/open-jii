-- Attached-AMBIT inventory, one record per change tuple (mqtt-payload.md §10).
--
-- The stable identity/change tuple is (sensor_id, firmware, cal_version): a
-- sensor swap changes sensor_id, a firmware update changes firmware, and any
-- byte of calibration -- including the name -- changes cal_version. A v3
-- producer only re-announces when that tuple changes, but a v2 producer
-- announced once per UART connection, so an unchanged tuple repeats in the raw
-- data. Grouping on the tuple collapses those repeats into one record;
-- observation_count keeps the evidence.
--
-- calibration_complete is false for legacy rows that never carried the full
-- coefficient set. Those stay queryable as legacy inventory rather than being
-- silently completed with invented numbers (§11.3).
CREATE OR REPLACE VIEW ${catalog}.${schema}.experiment_attached_sensors
COMMENT 'Attached-AMBIT inventory keyed by the (sensor_id, firmware, cal_version) change tuple (mqtt-payload.md 10).'
AS
SELECT
  experiment_id,
  sensor_id,
  cal_version,
  firmware,
  sensor_name,
  hardware_revision,
  channel,
  gateway_device_id,
  client_id,
  first_observed_utc,
  last_observed_utc,
  observation_count,
  calibration_complete,
  source_row_id,
  measure_id,
  source_generation,
  device_info
FROM (
  SELECT
    d.*,
    min(d.observed_utc) OVER tuple_window AS first_observed_utc,
    max(d.observed_utc) OVER tuple_window AS last_observed_utc,
    count(*) OVER tuple_window AS observation_count,
    row_number() OVER (
      PARTITION BY d.experiment_id, d.sensor_id, d.firmware, d.cal_version
      ORDER BY d.observed_utc DESC, d.source_row_id DESC
    ) AS tuple_rank
  FROM (
    SELECT
      n.experiment_id,
      n.id AS source_row_id,
      n.client_id,
      n.device_id AS gateway_device_id,
      timestamp_millis(try_variant_get(n.device_info, '$.time.observed_utc', 'bigint'))
        AS observed_utc,
      try_variant_get(n.device_info, '$.measure_id', 'bigint') AS measure_id,
      try_variant_get(n.device_info, '$.channel', 'string') AS channel,
      try_variant_get(n.device_info, '$.identity.sensor_id', 'string') AS sensor_id,
      try_variant_get(n.device_info, '$.identity.name', 'string') AS sensor_name,
      try_variant_get(n.device_info, '$.identity.firmware', 'string') AS firmware,
      try_variant_get(n.device_info, '$.identity.hardware_revision', 'int')
        AS hardware_revision,
      try_variant_get(n.device_info, '$.identity.cal_version', 'string') AS cal_version,
      coalesce(try_variant_get(n.device_info, '$._compat.source', 'string'), 'native')
        AS source_generation,
      (
        coalesce(
          array_size(try_variant_get(n.device_info, '$.calibration.mlx_coef', 'array<bigint>')), 0
        ) = 14
        AND coalesce(
          array_size(try_variant_get(n.device_info, '$.calibration.adpd', 'array<bigint>')), 0
        ) = 6
        AND coalesce(
          array_size(try_variant_get(n.device_info, '$.calibration.act', 'array<bigint>')), 0
        ) = 5
        AND try_variant_get(n.device_info, '$.calibration.temp_offset', 'double') IS NOT NULL
        AND try_variant_get(n.device_info, '$.calibration.temp_slope', 'double') IS NOT NULL
        AND try_variant_get(n.device_info, '$.calibration.actinic_coef', 'double') IS NOT NULL
        AND try_variant_get(n.device_info, '$.calibration.spec_coef', 'double') IS NOT NULL
        AND try_variant_get(n.device_info, '$.calibration.mlx_emissivity', 'double') IS NOT NULL
        AND try_variant_get(n.device_info, '$.calibration.sun_coef', 'double') IS NOT NULL
        AND try_variant_get(n.device_info, '$.calibration.tick_factor', 'double') IS NOT NULL
      ) AS calibration_complete,
      n.device_info
    FROM (
      SELECT
        r.*,
        ${catalog}.${schema}.ambit_device_v1(r.data, r.timestamp) AS device_info
      FROM ${catalog}.${schema}.experiment_raw_data AS r
    ) AS n
    WHERE n.device_info IS NOT NULL
  ) AS d
  WINDOW tuple_window AS (
    PARTITION BY d.experiment_id, d.sensor_id, d.firmware, d.cal_version
  )
) AS ranked
WHERE tuple_rank = 1
