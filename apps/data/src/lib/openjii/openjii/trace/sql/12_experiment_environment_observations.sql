-- Environment projection of the telemetry row (mqtt-payload.md §9.1).
--
-- The gateway BME280 as science observations, one row per source telemetry
-- event, carrying that event's identity (source_row_id, measure_id,
-- observed_utc). The health projection beside it points at the same row.
--
-- These values are gateway-level context. They are never copied into an AMBIT
-- trace's series, and a failed read yields no observations rather than nulls
-- dressed up as readings.
CREATE OR REPLACE VIEW ${catalog}.${schema}.experiment_environment_observations
COMMENT 'Gateway BME280 observations projected from ambyte.telemetry/1 (mqtt-payload.md 9.1).'
AS
SELECT
  experiment_id,
  source_row_id,
  measure_id,
  device_id,
  client_id,
  observed_utc,
  observed_utc_ms,
  timezone,
  date,
  source_generation,
  try_variant_get(telemetry, '$.observations.air_temperature.v', 'double') AS air_temperature,
  try_variant_get(telemetry, '$.observations.air_temperature.u', 'string') AS air_temperature_unit,
  try_variant_get(telemetry, '$.observations.relative_humidity.v', 'double') AS relative_humidity,
  try_variant_get(telemetry, '$.observations.relative_humidity.u', 'string')
    AS relative_humidity_unit,
  try_variant_get(telemetry, '$.observations.air_pressure.v', 'double') AS air_pressure,
  try_variant_get(telemetry, '$.observations.air_pressure.u', 'string') AS air_pressure_unit
FROM ${catalog}.${schema}.experiment_ambyte_telemetry
