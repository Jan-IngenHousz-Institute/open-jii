/** Identifiers come from server configuration; values use bound parameters. */
export function devicePowerQuery(table: string): string {
  // Ambyte time.observed_utc is milliseconds; envelope timestamps have whole seconds.
  return `WITH candidates AS (
    SELECT timestamp, processed_timestamp, sample
    FROM ${table}
    WHERE client_id = :thingName AND timestamp BETWEEN :from AND :to
      AND sample LIKE '%ambyte.telemetry/1%'
  ), telemetry AS (
    SELECT timestamp, processed_timestamp, entry
    FROM candidates
    LATERAL VIEW explode(from_json(sample, 'ARRAY<STRING>')) entries AS entry
    WHERE get_json_object(entry, '$.schema') = 'ambyte.telemetry/1'
  ), readings AS (
    SELECT *, from_json(entry, 'time STRUCT<observed_utc: BIGINT>, health STRUCT<power: STRUCT<valid: BOOLEAN, battery_v: DOUBLE>>') AS decoded
    FROM telemetry
  ), dated AS (
    SELECT *, coalesce(timestamp_millis(CASE WHEN decoded.time.observed_utc BETWEEN 0 AND 253402300799999
      THEN decoded.time.observed_utc END), timestamp) AS captured_at, decoded.health.power AS power
    FROM readings
  ), summary AS (
    SELECT
      max_by(named_struct('at', captured_at, 'entry', entry), struct(captured_at, timestamp, processed_timestamp, entry)) AS latest,
      max_by(named_struct('at', captured_at, 'entry', entry), struct(captured_at, timestamp, processed_timestamp, entry))
        FILTER (WHERE power.valid = true AND power.battery_v > 0 AND power.battery_v <= 1.7976931348623157E308) AS last_valid
    FROM dated WHERE captured_at BETWEEN :from AND :to
  )
  SELECT latest.at AS latest_at, latest.entry AS latest_entry,
    last_valid.at AS last_valid_at, last_valid.entry AS last_valid_entry FROM summary`;
}

export function deviceBatteryQuery(table: string, bucket: "hour" | "day"): string {
  return `WITH readings AS (
    SELECT timestamp, processed_timestamp,
      CASE WHEN device_battery BETWEEN -1.7976931348623157E308 AND 1.7976931348623157E308
        THEN device_battery END AS battery
    FROM ${table}
    WHERE client_id = :thingName AND timestamp BETWEEN :from AND :to
  ), buckets AS (
    SELECT date_trunc('${bucket}', timestamp) AS bucket_start,
      avg(battery) AS average_battery, count(*) AS sample_count, count(battery) AS reported_count,
      max_by(named_struct('at', timestamp, 'battery', battery), struct(timestamp, processed_timestamp, coalesce(battery, -1.7976931348623157E308))) AS latest,
      max(CASE WHEN battery IS NOT NULL THEN timestamp END) AS last_reported_at
    FROM readings GROUP BY date_trunc('${bucket}', timestamp)
  )
  SELECT bucket_start, average_battery, sample_count, reported_count,
    latest.at AS latest_at, latest.battery AS latest_battery, last_reported_at
  FROM buckets ORDER BY bucket_start`;
}
