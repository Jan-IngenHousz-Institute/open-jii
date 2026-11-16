-- Device pages read one device's rows across every experiment. FINAL never reads through a
-- projection (checked on 25.8), so a narrow copy of measurements ordered by device gives FINAL its own
-- key. The view fills it as rows land and a reload deletes its older rows with measurements', so it
-- folds and loses rows as measurements does. It leaves out the payloads, which most of the table's
-- size is; a device's newest rows take theirs from measurements. Rows without a client belong to no
-- device and are left out.
CREATE TABLE IF NOT EXISTS measurements_by_device
(
    client_id String,
    timestamp DateTime64(6, 'UTC'),
    id Int64,
    experiment_id String,
    device_id Nullable(String),
    device_version LowCardinality(Nullable(String)),
    device_firmware LowCardinality(Nullable(String)),
    device_battery Nullable(Float64),
    protocol_id Nullable(String),
    workbook_run_id Nullable(String),
    workbook_version_id Nullable(String),
    latitude Nullable(Float64),
    longitude Nullable(Float64),
    macros Array(Tuple(id Nullable(String), name Nullable(String), filename Nullable(String))),
    _commit_version Int64
)
ENGINE = ReplacingMergeTree(_commit_version)
PARTITION BY toYYYYMM(timestamp)
ORDER BY (client_id, timestamp, id, experiment_id, ifNull(device_id, ''));

CREATE MATERIALIZED VIEW IF NOT EXISTS measurements_by_device_feed TO measurements_by_device AS
SELECT
    assumeNotNull(client_id) AS client_id, timestamp, id, experiment_id, device_id, device_version,
    device_firmware, device_battery, protocol_id, workbook_run_id, workbook_version_id, latitude,
    longitude, macros, _commit_version
FROM measurements
WHERE measurements.client_id IS NOT NULL;

-- The rows already stored, after the view, so nothing inserted meanwhile is missed.
INSERT INTO measurements_by_device
SELECT
    assumeNotNull(client_id), timestamp, id, experiment_id, device_id, device_version, device_firmware,
    device_battery, protocol_id, workbook_run_id, workbook_version_id, latitude, longitude, macros,
    _commit_version
FROM measurements
WHERE client_id IS NOT NULL;

-- Silver's clean_device_lifecycle_events: each device's connects and disconnects, keyed as silver
-- drops repeats of one.
CREATE TABLE IF NOT EXISTS device_events
(
    client_id String,
    event_type LowCardinality(String),
    event_timestamp DateTime64(6, 'UTC'),
    session_identifier Nullable(String),
    disconnect_reason Nullable(String),
    _commit_version Int64,
    _commit_timestamp DateTime64(6, 'UTC'),
    inserted_at DateTime64(6, 'UTC') DEFAULT now64(6),
    -- The feed's lag check reads the last few minutes' rows once a minute; this skips the rest.
    INDEX recent_inserts inserted_at TYPE minmax GRANULARITY 1
)
ENGINE = ReplacingMergeTree(_commit_version)
PARTITION BY toYYYYMM(event_timestamp)
ORDER BY (client_id, event_timestamp, event_type, ifNull(session_identifier, ''))
SETTINGS non_replicated_deduplication_window = 10000;

-- The reader's way to devices' rows, each naming the devices it reads, which the backend has
-- authorised. Measurements and events read each row once at its newest commit.
CREATE VIEW IF NOT EXISTS device_measurements DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT * FROM measurements_by_device FINAL WHERE client_id IN {devices:Array(String)};

-- A device's newest rows in a window, whole, payloads included.
CREATE VIEW IF NOT EXISTS device_newest_measurements DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT * FROM measurements FINAL
WHERE (experiment_id, timestamp, id, ifNull(device_id, '')) IN (
    SELECT experiment_id, timestamp, id, ifNull(device_id, '') FROM measurements_by_device FINAL
    WHERE client_id = {device:String}
      AND timestamp BETWEEN {from:DateTime64(6, 'UTC')} AND {to:DateTime64(6, 'UTC')}
    ORDER BY timestamp DESC
    LIMIT {rows:UInt32}
);

CREATE VIEW IF NOT EXISTS device_lifecycle_events DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT * FROM device_events FINAL WHERE client_id IN {devices:Array(String)};

-- Each device's newest measurement and newest event. Every copy of a row has its key's time, so the
-- latest times need no FINAL.
CREATE VIEW IF NOT EXISTS device_last_activity DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT
    client_id,
    max(data_at) AS last_data_at,
    argMax(event_type, event_at) AS last_event_type,
    max(event_at) AS last_event_at
FROM
(
    SELECT
        client_id,
        timestamp AS data_at,
        CAST(NULL AS Nullable(String)) AS event_type,
        CAST(NULL AS Nullable(DateTime64(6, 'UTC'))) AS event_at
    FROM measurements_by_device
    WHERE client_id IN {devices:Array(String)}
    UNION ALL
    SELECT client_id, NULL, event_type, event_timestamp
    FROM device_events
    WHERE client_id IN {devices:Array(String)}
)
GROUP BY client_id;
