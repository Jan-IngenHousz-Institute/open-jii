-- Every AMBIT trace in one shape, v2 and v3 (mqtt-payload.md §8).
--
-- A view, not a table: normalization is a projection, and materializing pulse
-- grain for all history is what the Grebbedijk precedent warns against. Pass
-- `trace` to trace_points() to get the timeseries.
--
--   SELECT r.source_row_id, p.*
--   FROM experiment_ambit_trace r, LATERAL trace_points(r.trace) p
--   WHERE r.experiment_id = :exp;
--
-- `leaf_temp_time_estimated` is the flag to watch: those env timestamps come
-- from the firmware cadence model (±Δ), not from the device. Only idx-8 AMBIT
-- firmware retires it.
CREATE OR REPLACE VIEW ${catalog}.${schema}.experiment_ambit_trace
COMMENT 'AMBIT trace measurements normalized to ambit.trace/3, v2 rows included (mqtt-payload.md 8).'
AS
SELECT
  n.experiment_id,
  n.id AS source_row_id,
  n.timestamp AS measurement_time_utc,
  n.timezone,
  n.date,
  n.device_id AS gateway_device_id,
  n.client_id,
  n.device_name AS gateway_device_name,
  n.sensor_family,
  n.user_id,
  n.workbook_run_id,
  n.latitude,
  n.longitude,
  -- resolved attribution: the legacy topic segment, or the payload on the lean
  -- topic. payload_protocol_id is what the object itself claims.
  n.protocol_id,
  try_variant_get(n.trace, '$.protocol.id', 'string') AS payload_protocol_id,
  try_variant_get(n.trace, '$.schema', 'string') AS schema_tag,
  try_variant_get(n.trace, '$.measure_id', 'bigint') AS measure_id,
  try_variant_get(n.trace, '$.sensor_id', 'string') AS sensor_id,
  try_variant_get(n.trace, '$.device', 'string') AS sensor_name,
  try_variant_get(n.trace, '$.channel', 'string') AS channel,
  try_variant_get(n.trace, '$.tag', 'string') AS tag,
  try_variant_get(n.trace, '$.protocol.name', 'string') AS protocol_name,
  try_variant_get(n.trace, '$.protocol.cmd', 'string') AS protocol_cmd,
  try_variant_get(n.trace, '$.protocol.cal_version', 'string') AS cal_version,
  try_variant_get(n.trace, '$.protocol.tick_factor', 'double') AS tick_factor,
  try_variant_get(n.trace, '$.time.start_utc', 'bigint') AS start_utc_ms,
  try_variant_get(n.trace, '$.time.end_utc', 'bigint') AS end_utc_ms,
  try_variant_get(n.trace, '$.time.duration_ms', 'bigint') AS duration_ms,
  timestamp_millis(try_variant_get(n.trace, '$.time.start_utc', 'bigint')) AS start_utc,
  coalesce(try_variant_get(n.trace, '$._compat.source', 'string'), 'native') AS source_generation,
  coalesce(try_variant_get(n.trace, '$.series.leaf_temp.t_est', 'boolean'), false)
    AS leaf_temp_time_estimated,
  try_variant_get(n.trace, '$.series') AS series,
  n.trace
FROM (
  SELECT
    r.*,
    ${catalog}.${schema}.ambit_trace_v3(r.data, r.timestamp) AS trace
  FROM ${catalog}.${schema}.experiment_raw_data AS r
) AS n
WHERE n.trace IS NOT NULL
