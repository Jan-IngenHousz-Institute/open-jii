-- One canonical telemetry row per source event (mqtt-payload.md §9, §11).
--
-- The v3 heartbeat, the v2 STATUS heartbeat and the v2 standalone
-- device.bme280 snapshot all land here as ambyte.telemetry/1, one row in, one
-- row out. The environment and health views below project from this row and
-- keep its identity, so no raw event is duplicated or republished.
CREATE OR REPLACE VIEW ${catalog}.${schema}.experiment_ambyte_telemetry
COMMENT 'Gateway telemetry normalized to ambyte.telemetry/1, v2 STATUS and device.bme280 included (mqtt-payload.md 9, 11).'
AS
SELECT
  n.experiment_id,
  n.id AS source_row_id,
  n.timestamp AS event_time_utc,
  n.timezone,
  n.date,
  n.client_id,
  n.sensor_family,
  try_variant_get(n.telemetry, '$.device', 'string') AS device_id,
  try_variant_get(n.telemetry, '$.measure_id', 'bigint') AS measure_id,
  try_variant_get(n.telemetry, '$.time.observed_utc', 'bigint') AS observed_utc_ms,
  timestamp_millis(try_variant_get(n.telemetry, '$.time.observed_utc', 'bigint')) AS observed_utc,
  coalesce(try_variant_get(n.telemetry, '$._compat.source', 'string'), 'native')
    AS source_generation,
  n.telemetry
FROM (
  SELECT
    r.*,
    ${catalog}.${schema}.ambyte_telemetry_v1(r.data, r.timestamp, r.device_id) AS telemetry
  FROM ${catalog}.${schema}.experiment_raw_data AS r
) AS n
WHERE n.telemetry IS NOT NULL
