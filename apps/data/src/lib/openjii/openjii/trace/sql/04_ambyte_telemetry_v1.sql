-- Dual-read normalizer for gateway telemetry (mqtt-payload.md §9, §11.1, §11.2).
--
-- Three inputs, one canonical object: the v3 ambyte.telemetry/1 heartbeat, the
-- v2 STATUS heartbeat, and the v2 standalone device.bme280 snapshot. This is
-- where the ambiguous v2 split is resolved -- a BME280 reading that was both its
-- own MEASUREMENT and a copy inside every STATUS `data`, with health in
-- `metadata` -- into sibling `observations` and grouped `health` under one
-- observation time.
--
-- Normalization is one input row to one canonical object: it never merges
-- adjacent rows and never synthesizes a second raw row. The environment and
-- health views both project from this one object, keeping the same measure_id
-- and time, which is what "no duplicated raw events" means.
--
-- **Health belongs to the heartbeat only.** Every health leaf and every
-- attached-sensor reference is gated on the STATUS recognizer, so a standalone
-- device.bme280 row yields observations plus six empty health groups and
-- attached_sensors = [] (§11.2) even when its data/metadata carries health-shaped
-- keys. Reading them would attribute a gateway's state to an intentional
-- one-off environment snapshot.
--
-- Some older STATUS producers put the health keys in `data` and emitted a null
-- `metadata`, so every health leaf falls back to the same-named `data` key.
-- metadata wins when both are present. The three BME280 keys are observations
-- only and are never read into health.
--
-- Serialized precision from v2 is part of the compatibility contract (§9.3):
-- temperature and humidity two decimals, pressure one, voltages three. Rounding
-- goes through round_half_up(), which is half away from zero for both signs --
-- air temperature below freezing is an ordinary reading, and a bare
-- floor(x·10^d + 0.5) would round those halves the wrong way.
CREATE OR REPLACE FUNCTION ${catalog}.${schema}.ambyte_telemetry_v1(
  sample VARIANT,
  event_time TIMESTAMP,
  envelope_device_id STRING
)
RETURNS VARIANT
COMMENT 'Normalize a v3 heartbeat, v2 STATUS, or v2 device.bme280 row into one ambyte.telemetry/1 object; NULL otherwise (mqtt-payload.md 9, 11).'
DETERMINISTIC
RETURN (
  SELECT
    CASE
      WHEN b.schema_tag = 'ambyte.telemetry/1' THEN b.obj
      WHEN b.schema_tag IS NOT NULL THEN NULL
      WHEN NOT (b.is_v2_status OR b.is_v2_bme280) THEN NULL
      ELSE parse_json(to_json(named_struct(
        'schema', 'ambyte.telemetry/1',
        'measure_id', b.measure_id,
        'device', b.device,
        'tag', 'TELEMETRY',
        'time', named_struct('observed_utc', b.observed_utc),
        'observations', named_struct(
          'air_temperature', CASE WHEN b.temperature IS NOT NULL
            THEN named_struct('u', 'Cel', 'v', ${catalog}.${schema}.round_half_up(b.temperature, 2)) END,
          'relative_humidity', CASE WHEN b.humidity IS NOT NULL
            THEN named_struct('u', '%RH', 'v', ${catalog}.${schema}.round_half_up(b.humidity, 2)) END,
          'air_pressure', CASE WHEN b.pressure IS NOT NULL
            THEN named_struct('u', 'Pa', 'v', ${catalog}.${schema}.round_half_up(b.pressure, 1)) END
        ),
        -- every leaf below is NULL for a bme280 row, so each group renders as {}
        'health', named_struct(
          'connectivity', named_struct(
            'wifi', b.wifi,
            'provisioned', b.provisioned,
            'publish_gate', b.publish_gate,
            'mqtt_reconnects', b.mqtt_reconnects,
            'last_disc_reason', b.last_disc_reason,
            'conn_age_s', b.conn_age_s,
            'pending', b.pending
          ),
          'power', named_struct(
            'battery_v', ${catalog}.${schema}.round_half_up(b.battery_v, 3),
            'input_v', ${catalog}.${schema}.round_half_up(b.input_v, 3),
            'system_v', ${catalog}.${schema}.round_half_up(b.system_v, 3),
            'input_ma', b.input_ma,
            'charge_ma', b.charge_ma,
            'input_present', b.input_present,
            'charge_status', b.charge_status
          ),
          'storage', named_struct(
            'db_online', b.db_online,
            'sd_free_kb', b.sd_free_kb,
            'sd_skipped', b.sd_skipped,
            'sd_dropped', b.sd_dropped,
            'last_acked_id', b.last_acked_id,
            'sd_io_lost', b.sd_io_lost
          ),
          'runtime', named_struct(
            'uptime_s', b.uptime_s,
            'psram_free_kb', b.psram_free_kb,
            'psram_largest_kb', b.psram_largest_kb,
            'psram_size_kb', b.psram_size_kb,
            'heap_dma_largest_kb', b.heap_dma_largest_kb,
            'heap_int_free_kb', b.heap_int_free_kb,
            'heap_int_largest_kb', b.heap_int_largest_kb,
            'wd_armed', b.wd_armed,
            'last_wd_reboot_reason', b.last_wd_reboot_reason
          ),
          'clock', named_struct('source', b.clock_source, 'suspect', b.clock_suspect),
          'software', named_struct(
            'firmware', b.firmware,
            'script_sha256', b.script_sha256,
            'script_version', b.script_version,
            'script_built_against_fw', b.script_built_against_fw,
            'script_installed_on_fw', b.script_installed_on_fw,
            'script_metadata_verified', b.script_metadata_verified
          ),
          -- cache-only last-identified references, at most one per channel; no
          -- calibration coefficients, absence is not live absence, and nothing
          -- at all for a bme280 row
          'attached_sensors', filter(
            array(b.ambit0, b.ambit1, b.ambit2, b.ambit3),
            s -> b.is_v2_status AND s.sensor_id IS NOT NULL
          )
        ),
        '_compat', named_struct(
          'source', CASE WHEN b.is_v2_bme280 THEN 'v2.device.bme280' ELSE 'v2.STATUS' END
        )
      )))
    END
  FROM (
    -- 2: identity, observations, and the health leaves the recognizer allows
    SELECT
      a.*,
      -- sample device when it is a MAC, else the envelope's gateway id
      CASE
        WHEN try_variant_get(a.obj, '$.device', 'string')
          RLIKE '^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$'
          THEN upper(try_variant_get(a.obj, '$.device', 'string'))
        ELSE upper(envelope_device_id)
      END AS device,
      coalesce(
        try_variant_get(a.obj, '$.startTicks_UTC', 'bigint'),
        try_variant_get(a.obj, '$.startTicks', 'bigint'),
        unix_millis(event_time)
      ) AS observed_utc,
      -- observations: data only, never metadata, for both recognized shapes
      try_variant_get(a.obj, '$.data.temperature', 'double') AS temperature,
      try_variant_get(a.obj, '$.data.humidity', 'double') AS humidity,
      try_variant_get(a.obj, '$.data.pressure', 'double') AS pressure,
      -- health: metadata first, then the same-named data key, STATUS rows only
      -- connectivity
      -- wifi
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.wifi', 'boolean'),
        try_variant_get(a.obj, '$.data.wifi', 'boolean')
      ) END AS wifi,
      -- provisioned
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.provisioned', 'boolean'),
        try_variant_get(a.obj, '$.data.provisioned', 'boolean')
      ) END AS provisioned,
      -- publish_gate
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.publish_gate', 'boolean'),
        try_variant_get(a.obj, '$.data.publish_gate', 'boolean')
      ) END AS publish_gate,
      -- mqtt_reconnects
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.mqtt_reconnects', 'bigint'),
        try_variant_get(a.obj, '$.data.mqtt_reconnects', 'bigint')
      ) END AS mqtt_reconnects,
      -- last_disc_reason
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.last_disc_reason', 'string'),
        try_variant_get(a.obj, '$.data.last_disc_reason', 'string')
      ) END AS last_disc_reason,
      -- conn_age_s
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.conn_age_s', 'bigint'),
        try_variant_get(a.obj, '$.data.conn_age_s', 'bigint')
      ) END AS conn_age_s,
      -- pending
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.pending', 'bigint'),
        try_variant_get(a.obj, '$.data.pending', 'bigint')
      ) END AS pending,
      -- power
      -- battery_v
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.battery_v', 'double'),
        try_variant_get(a.obj, '$.data.battery_v', 'double')
      ) END AS battery_v,
      -- input_v
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.input_v', 'double'),
        try_variant_get(a.obj, '$.data.input_v', 'double')
      ) END AS input_v,
      -- system_v
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.system_v', 'double'),
        try_variant_get(a.obj, '$.data.system_v', 'double')
      ) END AS system_v,
      -- input_ma
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.input_ma', 'bigint'),
        try_variant_get(a.obj, '$.data.input_ma', 'bigint')
      ) END AS input_ma,
      -- charge_ma
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.charge_ma', 'bigint'),
        try_variant_get(a.obj, '$.data.charge_ma', 'bigint')
      ) END AS charge_ma,
      -- input_present
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.input_present', 'boolean'),
        try_variant_get(a.obj, '$.data.input_present', 'boolean')
      ) END AS input_present,
      -- charge_status
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.charge_status', 'bigint'),
        try_variant_get(a.obj, '$.data.charge_status', 'bigint')
      ) END AS charge_status,
      -- storage
      -- db_online
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.db_online', 'boolean'),
        try_variant_get(a.obj, '$.data.db_online', 'boolean')
      ) END AS db_online,
      -- sd_free_kb
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.sd_free_kb', 'bigint'),
        try_variant_get(a.obj, '$.data.sd_free_kb', 'bigint')
      ) END AS sd_free_kb,
      -- sd_skipped
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.sd_skipped', 'bigint'),
        try_variant_get(a.obj, '$.data.sd_skipped', 'bigint')
      ) END AS sd_skipped,
      -- sd_dropped
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.sd_dropped', 'bigint'),
        try_variant_get(a.obj, '$.data.sd_dropped', 'bigint')
      ) END AS sd_dropped,
      -- last_acked_id
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.last_acked_id', 'bigint'),
        try_variant_get(a.obj, '$.data.last_acked_id', 'bigint')
      ) END AS last_acked_id,
      -- sd_io_lost
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.sd_io_lost', 'boolean'),
        try_variant_get(a.obj, '$.data.sd_io_lost', 'boolean')
      ) END AS sd_io_lost,
      -- runtime
      -- uptime_s
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.uptime_s', 'bigint'),
        try_variant_get(a.obj, '$.data.uptime_s', 'bigint')
      ) END AS uptime_s,
      -- psram_free_kb
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.psram_free_kb', 'bigint'),
        try_variant_get(a.obj, '$.data.psram_free_kb', 'bigint')
      ) END AS psram_free_kb,
      -- psram_largest_kb
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.psram_largest_kb', 'bigint'),
        try_variant_get(a.obj, '$.data.psram_largest_kb', 'bigint')
      ) END AS psram_largest_kb,
      -- psram_size_kb
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.psram_size_kb', 'bigint'),
        try_variant_get(a.obj, '$.data.psram_size_kb', 'bigint')
      ) END AS psram_size_kb,
      -- heap_dma_largest_kb
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.heap_dma_largest_kb', 'bigint'),
        try_variant_get(a.obj, '$.data.heap_dma_largest_kb', 'bigint')
      ) END AS heap_dma_largest_kb,
      -- heap_int_free_kb
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.heap_int_free_kb', 'bigint'),
        try_variant_get(a.obj, '$.data.heap_int_free_kb', 'bigint')
      ) END AS heap_int_free_kb,
      -- heap_int_largest_kb
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.heap_int_largest_kb', 'bigint'),
        try_variant_get(a.obj, '$.data.heap_int_largest_kb', 'bigint')
      ) END AS heap_int_largest_kb,
      -- wd_armed
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.wd_armed', 'boolean'),
        try_variant_get(a.obj, '$.data.wd_armed', 'boolean')
      ) END AS wd_armed,
      -- last_wd_reboot_reason
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.last_wd_reboot_reason', 'string'),
        try_variant_get(a.obj, '$.data.last_wd_reboot_reason', 'string')
      ) END AS last_wd_reboot_reason,
      -- clock
      -- clock_src
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.clock_src', 'string'),
        try_variant_get(a.obj, '$.data.clock_src', 'string')
      ) END AS clock_source,
      -- clock_suspect
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.clock_suspect', 'boolean'),
        try_variant_get(a.obj, '$.data.clock_suspect', 'boolean')
      ) END AS clock_suspect,
      -- software
      -- app_version
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.app_version', 'string'),
        try_variant_get(a.obj, '$.data.app_version', 'string')
      ) END AS firmware,
      -- script_sha256
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.script_sha256', 'string'),
        try_variant_get(a.obj, '$.data.script_sha256', 'string')
      ) END AS script_sha256,
      -- script_version
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.script_version', 'string'),
        try_variant_get(a.obj, '$.data.script_version', 'string')
      ) END AS script_version,
      -- script_built_against_fw
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.script_built_against_fw', 'string'),
        try_variant_get(a.obj, '$.data.script_built_against_fw', 'string')
      ) END AS script_built_against_fw,
      -- script_installed_on_fw
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.script_installed_on_fw', 'string'),
        try_variant_get(a.obj, '$.data.script_installed_on_fw', 'string')
      ) END AS script_installed_on_fw,
      -- script_metadata_verified
      CASE WHEN a.is_v2_status THEN coalesce(
        try_variant_get(a.obj, '$.metadata.script_metadata_verified', 'boolean'),
        try_variant_get(a.obj, '$.data.script_metadata_verified', 'boolean')
      ) END AS script_metadata_verified,
      -- attached-sensor references, one struct per port
      named_struct(
        'channel', 'uart_0',
        'sensor_id', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit0_id', 'string'),
          try_variant_get(a.obj, '$.data.ambit0_id', 'string')
        ),
        'firmware', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit0_fw', 'string'),
          try_variant_get(a.obj, '$.data.ambit0_fw', 'string')
        ),
        'hardware_revision', nullif(coalesce(
          try_variant_get(a.obj, '$.metadata.ambit0_hw', 'bigint'),
          try_variant_get(a.obj, '$.data.ambit0_hw', 'bigint')
        ), 0),
        'name', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit0_name', 'string'),
          try_variant_get(a.obj, '$.data.ambit0_name', 'string')
        ),
        'cal_version', ${catalog}.${schema}.cal_version_hex8(coalesce(
          try_variant_get(a.obj, '$.metadata.ambit0_cal', 'string'),
          try_variant_get(a.obj, '$.data.ambit0_cal', 'string')
        ))
      ) AS ambit0,
      named_struct(
        'channel', 'uart_1',
        'sensor_id', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit1_id', 'string'),
          try_variant_get(a.obj, '$.data.ambit1_id', 'string')
        ),
        'firmware', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit1_fw', 'string'),
          try_variant_get(a.obj, '$.data.ambit1_fw', 'string')
        ),
        'hardware_revision', nullif(coalesce(
          try_variant_get(a.obj, '$.metadata.ambit1_hw', 'bigint'),
          try_variant_get(a.obj, '$.data.ambit1_hw', 'bigint')
        ), 0),
        'name', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit1_name', 'string'),
          try_variant_get(a.obj, '$.data.ambit1_name', 'string')
        ),
        'cal_version', ${catalog}.${schema}.cal_version_hex8(coalesce(
          try_variant_get(a.obj, '$.metadata.ambit1_cal', 'string'),
          try_variant_get(a.obj, '$.data.ambit1_cal', 'string')
        ))
      ) AS ambit1,
      named_struct(
        'channel', 'uart_2',
        'sensor_id', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit2_id', 'string'),
          try_variant_get(a.obj, '$.data.ambit2_id', 'string')
        ),
        'firmware', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit2_fw', 'string'),
          try_variant_get(a.obj, '$.data.ambit2_fw', 'string')
        ),
        'hardware_revision', nullif(coalesce(
          try_variant_get(a.obj, '$.metadata.ambit2_hw', 'bigint'),
          try_variant_get(a.obj, '$.data.ambit2_hw', 'bigint')
        ), 0),
        'name', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit2_name', 'string'),
          try_variant_get(a.obj, '$.data.ambit2_name', 'string')
        ),
        'cal_version', ${catalog}.${schema}.cal_version_hex8(coalesce(
          try_variant_get(a.obj, '$.metadata.ambit2_cal', 'string'),
          try_variant_get(a.obj, '$.data.ambit2_cal', 'string')
        ))
      ) AS ambit2,
      named_struct(
        'channel', 'uart_3',
        'sensor_id', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit3_id', 'string'),
          try_variant_get(a.obj, '$.data.ambit3_id', 'string')
        ),
        'firmware', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit3_fw', 'string'),
          try_variant_get(a.obj, '$.data.ambit3_fw', 'string')
        ),
        'hardware_revision', nullif(coalesce(
          try_variant_get(a.obj, '$.metadata.ambit3_hw', 'bigint'),
          try_variant_get(a.obj, '$.data.ambit3_hw', 'bigint')
        ), 0),
        'name', coalesce(
          try_variant_get(a.obj, '$.metadata.ambit3_name', 'string'),
          try_variant_get(a.obj, '$.data.ambit3_name', 'string')
        ),
        'cal_version', ${catalog}.${schema}.cal_version_hex8(coalesce(
          try_variant_get(a.obj, '$.metadata.ambit3_cal', 'string'),
          try_variant_get(a.obj, '$.data.ambit3_cal', 'string')
        ))
      ) AS ambit3
    FROM (
      -- 1: the measurement object and the row taxonomy
      SELECT
        o.obj,
        try_variant_get(o.obj, '$.schema', 'string') AS schema_tag,
        try_variant_get(o.obj, '$.measure_id', 'bigint') AS measure_id,
        -- transport tag STATUS, or the legacy sensor:"status" spelling. Both
        -- terms are coalesced: a NULL tag must read as "not a heartbeat", and a
        -- NULL recognizer would fall through to normalizing anything.
        (
          coalesce(try_variant_get(o.obj, '$.tag', 'string') = 'STATUS', false)
          OR lower(coalesce(try_variant_get(o.obj, '$.sensor', 'string'), '')) = 'status'
        ) AS is_v2_status,
        coalesce(
          try_variant_get(o.obj, '$.cmd_raw', 'string') = 'device.bme280', false
        ) AS is_v2_bme280
      FROM (SELECT ${catalog}.${schema}.measurement_object(sample) AS obj) AS o
    ) AS a
  ) AS b
)
