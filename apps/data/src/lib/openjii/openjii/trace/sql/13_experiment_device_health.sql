-- Health projection of the telemetry row (mqtt-payload.md §9.2).
--
-- Same source event as the environment projection -- same source_row_id,
-- measure_id and observed_utc -- flattened by concern. An explicit BME280
-- snapshot projects here too, with every leaf null: the groups exist and are
-- empty, which is the contract's way of saying "not sampled", not "zero".
--
-- attached_sensors is a cache-only reference list. A channel missing from it
-- means no cached identity, NOT that the port is empty; nothing in the
-- heartbeat may initiate UART I/O to find out.
CREATE OR REPLACE VIEW ${catalog}.${schema}.experiment_device_health
COMMENT 'Gateway health projected from ambyte.telemetry/1 (mqtt-payload.md 9.2).'
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
  try_variant_get(telemetry, '$.health.connectivity.wifi', 'boolean') AS wifi,
  try_variant_get(telemetry, '$.health.connectivity.provisioned', 'boolean') AS provisioned,
  try_variant_get(telemetry, '$.health.connectivity.publish_gate', 'boolean') AS publish_gate,
  try_variant_get(telemetry, '$.health.connectivity.mqtt_reconnects', 'bigint')
    AS mqtt_reconnects,
  try_variant_get(telemetry, '$.health.connectivity.last_disc_reason', 'string')
    AS last_disc_reason,
  try_variant_get(telemetry, '$.health.connectivity.conn_age_s', 'bigint') AS conn_age_s,
  try_variant_get(telemetry, '$.health.connectivity.pending', 'bigint') AS pending,
  try_variant_get(telemetry, '$.health.power.battery_v', 'double') AS battery_v,
  try_variant_get(telemetry, '$.health.power.input_v', 'double') AS input_v,
  try_variant_get(telemetry, '$.health.power.system_v', 'double') AS system_v,
  try_variant_get(telemetry, '$.health.power.input_ma', 'bigint') AS input_ma,
  try_variant_get(telemetry, '$.health.power.charge_ma', 'bigint') AS charge_ma,
  try_variant_get(telemetry, '$.health.power.input_present', 'boolean') AS input_present,
  try_variant_get(telemetry, '$.health.power.charge_status', 'bigint') AS charge_status,
  try_variant_get(telemetry, '$.health.storage.db_online', 'boolean') AS db_online,
  try_variant_get(telemetry, '$.health.storage.sd_free_kb', 'bigint') AS sd_free_kb,
  try_variant_get(telemetry, '$.health.storage.sd_skipped', 'bigint') AS sd_skipped,
  try_variant_get(telemetry, '$.health.storage.sd_dropped', 'bigint') AS sd_dropped,
  try_variant_get(telemetry, '$.health.storage.last_acked_id', 'bigint') AS last_acked_id,
  try_variant_get(telemetry, '$.health.storage.sd_io_lost', 'boolean') AS sd_io_lost,
  try_variant_get(telemetry, '$.health.runtime.uptime_s', 'bigint') AS uptime_s,
  try_variant_get(telemetry, '$.health.runtime.psram_free_kb', 'bigint') AS psram_free_kb,
  try_variant_get(telemetry, '$.health.runtime.psram_largest_kb', 'bigint') AS psram_largest_kb,
  try_variant_get(telemetry, '$.health.runtime.psram_size_kb', 'bigint') AS psram_size_kb,
  try_variant_get(telemetry, '$.health.runtime.heap_dma_largest_kb', 'bigint')
    AS heap_dma_largest_kb,
  try_variant_get(telemetry, '$.health.runtime.heap_int_free_kb', 'bigint') AS heap_int_free_kb,
  try_variant_get(telemetry, '$.health.runtime.heap_int_largest_kb', 'bigint')
    AS heap_int_largest_kb,
  try_variant_get(telemetry, '$.health.runtime.wd_armed', 'boolean') AS wd_armed,
  try_variant_get(telemetry, '$.health.runtime.last_wd_reboot_reason', 'string')
    AS last_wd_reboot_reason,
  try_variant_get(telemetry, '$.health.clock.source', 'string') AS clock_source,
  try_variant_get(telemetry, '$.health.clock.suspect', 'boolean') AS clock_suspect,
  try_variant_get(telemetry, '$.health.software.firmware', 'string') AS firmware,
  try_variant_get(telemetry, '$.health.software.script_sha256', 'string') AS script_sha256,
  try_variant_get(telemetry, '$.health.software.script_version', 'string') AS script_version,
  try_variant_get(telemetry, '$.health.software.script_built_against_fw', 'string')
    AS script_built_against_fw,
  try_variant_get(telemetry, '$.health.software.script_installed_on_fw', 'string')
    AS script_installed_on_fw,
  try_variant_get(telemetry, '$.health.software.script_metadata_verified', 'boolean')
    AS script_metadata_verified,
  try_variant_get(
    telemetry,
    '$.health.attached_sensors',
    'array<struct<channel:string,sensor_id:string,firmware:string,hardware_revision:int,name:string,cal_version:string>>'
  ) AS attached_sensors
FROM ${catalog}.${schema}.experiment_ambyte_telemetry
