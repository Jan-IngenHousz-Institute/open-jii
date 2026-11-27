-- measurements' rows by device, holding what device pages read, so a device's reads touch its own
-- rows alone. measurements' key leaves out the client, so of a capture sent again through another
-- client it keeps only one client's row, while this keeps one per client. The view below adds each
-- inserted row stamped with the time it lands. After each chunk it inserts, the writer rewrites every
-- client's row of the chunk's captures from what measurements FINAL keeps: the kept row with its
-- fields, every other client's replaced (Measurements.settle in apps/data's serving_store/tables.py).
-- Each settle stamps its rows with the store's time, read before the settle reads anything, and FINAL
-- here keeps the newest stamp, so the settle stamped last, after every insert it could miss had
-- landed, decides each row whichever finishes last. A reload retires rows the same way, with a
-- stamped replaced row, before it deletes them. Every insert into measurements must go through that
-- writer: one by hand leaves this copy out of step until a reload. Its own dedup window drops a chunk
-- the feed sends again after a reload deleted it. The projection finds a capture's rows of every
-- client for the settle. FINAL never reads it, and merges and the reload's deletes rebuild it.
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
    _commit_version Int64,
    is_replaced UInt8 DEFAULT 0,
    _settle_version UInt64 DEFAULT 0,
    PROJECTION by_capture
    (
        SELECT experiment_id, timestamp, id, device_id, client_id
        ORDER BY experiment_id, timestamp, id, ifNull(device_id, '')
    )
)
ENGINE = ReplacingMergeTree(_settle_version, is_replaced)
PARTITION BY toYYYYMM(timestamp)
ORDER BY (client_id, timestamp, id, experiment_id, ifNull(device_id, ''))
SETTINGS
    non_replicated_deduplication_window = 10000,
    deduplicate_merge_projection_mode = 'rebuild',
    lightweight_mutation_projection_mode = 'rebuild';

-- Stamped as it lands, as a settle stamps its rows: a merge then keeps the newer insert over any row
-- a settle stamped before it, which never read it, and the row's own settle stamps later still.
CREATE MATERIALIZED VIEW IF NOT EXISTS measurements_by_device_feed TO measurements_by_device AS
SELECT
    assumeNotNull(client_id) AS client_id, timestamp, id, experiment_id, device_id, device_version,
    device_firmware, device_battery, protocol_id, workbook_run_id, workbook_version_id, latitude,
    longitude, macros, _commit_version, toUnixTimestamp64Nano(now64(9)) AS _settle_version
FROM measurements
WHERE measurements.client_id IS NOT NULL;

-- The rows already stored, as FINAL keeps them, so one per capture and none to mark. After the view,
-- so nothing inserted meanwhile is missed. They can span more months than one insert block may.
INSERT INTO measurements_by_device (
    client_id, timestamp, id, experiment_id, device_id, device_version, device_firmware, device_battery,
    protocol_id, workbook_run_id, workbook_version_id, latitude, longitude, macros, _commit_version
)
SELECT
    assumeNotNull(client_id), timestamp, id, experiment_id, device_id, device_version, device_firmware,
    device_battery, protocol_id, workbook_run_id, workbook_version_id, latitude, longitude, macros,
    _commit_version
FROM measurements FINAL
WHERE client_id IS NOT NULL
SETTINGS throw_on_max_partitions_per_insert_block = 0;

-- Silver's clean_device_lifecycle_events: each device's connects and disconnects, keyed as silver
-- drops repeats of one, which keeps a null session apart from an empty one.
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
ORDER BY (client_id, event_timestamp, event_type, isNull(session_identifier), ifNull(session_identifier, ''))
SETTINGS non_replicated_deduplication_window = 10000;

-- The reader's way to devices' rows in a window, each naming the devices it reads, which the backend
-- has authorized. FINAL leaves out a row another client's copy of its capture replaced.
CREATE VIEW IF NOT EXISTS device_measurements DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT
    client_id, timestamp, id, experiment_id, device_id, device_version, device_firmware, device_battery,
    protocol_id, workbook_run_id, workbook_version_id, latitude, longitude, macros, _commit_version
FROM measurements_by_device FINAL
WHERE client_id IN {devices:Array(String)}
  AND timestamp BETWEEN {from:DateTime64(6, 'UTC')} AND {to:DateTime64(6, 'UTC')};

-- The experiments that devices' rows in a window name, without FINAL, so a replaced row still names
-- its experiment: the ids only widen the list the backend checks access on, and every count, newest
-- row and last activity leaves replaced rows out itself.
CREATE VIEW IF NOT EXISTS device_experiment_ids DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT DISTINCT experiment_id FROM measurements_by_device
WHERE client_id IN {devices:Array(String)}
  AND timestamp BETWEEN {from:DateTime64(6, 'UTC')} AND {to:DateTime64(6, 'UTC')};

-- A device's rows span experiments, so this names the device's readings rather than every field. The
-- cut takes the device's rows as device_measurements does, and the payloads are read for the cut's
-- rows alone. Their client is checked again after FINAL, so a payload and position reach only the
-- client whose row won.
CREATE VIEW IF NOT EXISTS device_newest_measurements DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT
    timestamp, experiment_id, id, protocol_id, workbook_version_id, device_version, device_battery,
    latitude, longitude, data
FROM measurements FINAL
WHERE client_id = {device:String}
  AND (experiment_id, timestamp, id, ifNull(device_id, '')) IN (
    SELECT experiment_id, timestamp, id, ifNull(device_id, '') FROM measurements_by_device FINAL
    WHERE client_id = {device:String}
      AND timestamp BETWEEN {from:DateTime64(6, 'UTC')} AND {to:DateTime64(6, 'UTC')}
      -- Only the experiments the caller may read, before the cut, so another's rows never take a place.
      AND has({experiments:Array(String)}, experiment_id)
    -- The whole key, so rows that tie on time fall the same side of the cut on every read.
    ORDER BY timestamp DESC, id DESC, experiment_id DESC, ifNull(device_id, '') DESC
    LIMIT {rows:UInt32}
);

CREATE VIEW IF NOT EXISTS device_lifecycle_events DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT * FROM device_events FINAL WHERE client_id IN {devices:Array(String)};

-- Each reload of every experiment that passed its checks, which the reload writes once its last row
-- is in and its counts match. Only the reloader inserts here, and nothing merges or deletes the rows.
CREATE TABLE IF NOT EXISTS completed_reloads
(
    table_name LowCardinality(String),
    version Int64,
    completed_at DateTime64(6, 'UTC') DEFAULT now64(6)
)
ENGINE = MergeTree
ORDER BY (table_name, completed_at);

-- One row once reloads of every experiment have passed for device events, which alone bring those
-- from before the feed's start, and for measurements, which alone fill older rows' firmware and
-- battery.
CREATE VIEW IF NOT EXISTS device_events_reloaded DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT 1 AS reloaded FROM completed_reloads
WHERE table_name IN ('measurements', 'device_events')
HAVING uniqExact(table_name) = 2;

-- A device's last data is its newest row as device_measurements takes them, in the experiments the
-- caller may read; connects and disconnects belong to no experiment.
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
    FROM measurements_by_device FINAL
    WHERE client_id IN {devices:Array(String)} AND has({experiments:Array(String)}, experiment_id)
    UNION ALL
    SELECT client_id, NULL, event_type, event_timestamp
    FROM device_events
    WHERE client_id IN {devices:Array(String)}
)
GROUP BY client_id;
