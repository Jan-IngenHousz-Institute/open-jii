/** Identifiers come from server configuration; values use bound parameters. */
export function devicePowerQuery(table: string): string {
  return `WITH telemetry AS (
    SELECT timestamp, processed_timestamp, entry
    FROM ${table}
    LATERAL VIEW explode(from_json(sample, 'ARRAY<STRING>')) entries AS entry
    WHERE client_id = :thingName AND timestamp BETWEEN :from AND :to
      AND get_json_object(entry, '$.schema') = 'ambyte.telemetry/1'
  ), readings AS (
    SELECT *, from_json(entry, 'health STRUCT<power: STRUCT<valid: BOOLEAN, battery_v: DOUBLE>>').health.power AS power
    FROM telemetry
  ), summary AS (
    SELECT
      max_by(named_struct('at', timestamp, 'entry', entry), struct(timestamp, processed_timestamp, entry)) AS latest,
      max_by(named_struct('at', timestamp, 'entry', entry), struct(timestamp, processed_timestamp, entry))
        FILTER (WHERE power.valid = true AND power.battery_v > 0 AND power.battery_v <= 1.7976931348623157E308) AS last_valid
    FROM readings
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
