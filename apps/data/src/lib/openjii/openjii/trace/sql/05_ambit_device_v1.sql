-- Dual-read normalizer for attached-AMBIT inventory (mqtt-payload.md §10, §11.3).
--
-- Identity and full calibration are slowly changing inventory, not telemetry:
-- one event on first discovery and then only when the
-- (sensor_id, firmware, cal_version) tuple changes. This restates the v2
-- DEVICE_INFO row in that shape so both generations feed one dimension.
--
-- Calibration coefficients are never invented: a legacy row missing them stays
-- queryable and is flagged incomplete by the view, per §11.3.
CREATE OR REPLACE FUNCTION ${catalog}.${schema}.ambit_device_v1(
  sample VARIANT,
  event_time TIMESTAMP
)
RETURNS VARIANT
COMMENT 'Normalize a v3 or v2 DEVICE_INFO row into one ambit.device/1 object; NULL otherwise (mqtt-payload.md 10, 11.3).'
DETERMINISTIC
RETURN (
  SELECT
    CASE
      WHEN a.schema_tag = 'ambit.device/1' THEN a.obj
      WHEN a.schema_tag IS NOT NULL THEN NULL
      WHEN NOT a.is_v2_device_info THEN NULL
      ELSE parse_json(to_json(named_struct(
        'schema', 'ambit.device/1',
        'measure_id', a.measure_id,
        'channel', a.channel,
        'device', a.device_name,
        'tag', 'DEVICE_INFO',
        'time', named_struct('observed_utc', a.observed_utc),
        'identity', named_struct(
          'sensor_id', a.sensor_id,
          'name', a.device_name,
          'firmware', a.fw,
          'hardware_revision', a.hardware_revision,
          'cal_version', a.cal_version
        ),
        'calibration', named_struct(
          'mlx_coef', a.mlx_coef,
          'adpd', a.adpd,
          'temp_offset', a.temp_offset,
          'temp_slope', a.temp_slope,
          'actinic_coef', a.actinic_coef,
          'spec_coef', a.spec_coef,
          'act', a.act,
          'mlx_emissivity', a.mlx_emissivity,
          'sun_coef', a.sun_coef,
          'tick_factor', a.tick_factor
        ),
        '_compat', named_struct('source', 'v2.DEVICE_INFO')
      )))
    END
  FROM (
    SELECT
      o.obj,
      try_variant_get(o.obj, '$.schema', 'string') AS schema_tag,
      try_variant_get(o.obj, '$.measure_id', 'bigint') AS measure_id,
      try_variant_get(o.obj, '$.channel', 'string') AS channel,
      -- sample device, else the pre-discovery placeholder the firmware uses
      coalesce(try_variant_get(o.obj, '$.device', 'string'), 'ambit') AS device_name,
      coalesce(
        try_variant_get(o.obj, '$.startTicks_UTC', 'bigint'),
        try_variant_get(o.obj, '$.startTicks', 'bigint'),
        unix_millis(event_time)
      ) AS observed_utc,
      CASE
        WHEN try_variant_get(o.obj, '$.data.device_id', 'string')
          RLIKE '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$'
          THEN upper(try_variant_get(o.obj, '$.data.device_id', 'string'))
        ELSE try_variant_get(o.obj, '$.data.device_id', 'string')
      END AS sensor_id,
      try_variant_get(o.obj, '$.data.fw', 'string') AS fw,
      -- legacy rows normally omit it; pre-revision firmware sends zero
      nullif(try_variant_get(o.obj, '$.metadata.hw_rev', 'bigint'), 0) AS hardware_revision,
      ${catalog}.${schema}.cal_version_hex8(
        try_variant_get(o.obj, '$.data.cal_version', 'string')
      ) AS cal_version,
      try_variant_get(o.obj, '$.data.mlx_coef', 'array<bigint>') AS mlx_coef,
      try_variant_get(o.obj, '$.data.adpd', 'array<bigint>') AS adpd,
      try_variant_get(o.obj, '$.data.temp_offset', 'double') AS temp_offset,
      try_variant_get(o.obj, '$.data.temp_slope', 'double') AS temp_slope,
      try_variant_get(o.obj, '$.data.actinic_coef', 'double') AS actinic_coef,
      try_variant_get(o.obj, '$.data.spec_coef', 'double') AS spec_coef,
      try_variant_get(o.obj, '$.data.act', 'array<bigint>') AS act,
      try_variant_get(o.obj, '$.data.mlx_emissivity', 'double') AS mlx_emissivity,
      try_variant_get(o.obj, '$.data.sun_coef', 'double') AS sun_coef,
      try_variant_get(o.obj, '$.data.tick_factor', 'double') AS tick_factor,
      -- both terms coalesced: a NULL tag must read as "not an announcement",
      -- otherwise the recognizer is NULL and the row falls through to normalization
      (
        coalesce(try_variant_get(o.obj, '$.tag', 'string') = 'DEVICE_INFO', false)
        OR coalesce(try_variant_get(o.obj, '$.cmd_raw', 'string') = 'get_info', false)
      ) AS is_v2_device_info
    FROM (SELECT ${catalog}.${schema}.measurement_object(sample) AS obj) AS o
  ) AS a
)
