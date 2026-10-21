-- Gold's experiment_macro_data. A result's id hashes its measurement's processing time, which changes
-- whenever silver reprocesses it, so the key names the measurement and the macro file instead: a
-- recomputed result replaces the old one.
CREATE TABLE IF NOT EXISTS macro_results
(
    experiment_id String,
    id Int64,
    raw_id Int64,
    device_id Nullable(String),
    client_id Nullable(String),
    device_name Nullable(String),
    timestamp DateTime64(6, 'UTC'),
    timezone LowCardinality(Nullable(String)),
    measurement_time_local Nullable(String),
    user_id Nullable(String),
    latitude Nullable(Float64),
    longitude Nullable(Float64),
    macro_id String,
    macro_name Nullable(String),
    macro_filename String,
    workbook_run_id Nullable(String),
    workbook_version_id Nullable(String),
    -- Per-row path functions such as JSONAllPaths need assumeNotNull(macro_output).
    macro_output Nullable(JSON),
    macro_error Nullable(String),
    processed_timestamp Nullable(DateTime64(6, 'UTC')),
    questions_data Map(LowCardinality(String), Nullable(String)),
    annotations Array(Tuple(
        id Nullable(String),
        rowId Nullable(String),
        type Nullable(String),
        content Tuple(text Nullable(String), flagType Nullable(String)),
        createdBy Nullable(String),
        createdByName Nullable(String),
        createdAt Nullable(DateTime64(6, 'UTC')),
        updatedAt Nullable(DateTime64(6, 'UTC'))
    )),
    _commit_version Int64,
    _commit_timestamp DateTime64(6, 'UTC'),
    inserted_at DateTime64(6, 'UTC') DEFAULT now64(6),
    -- The feed's lag check reads the last few minutes' rows once a minute; this skips the rest.
    INDEX recent_inserts inserted_at TYPE minmax GRANULARITY 1
)
ENGINE = ReplacingMergeTree(_commit_version)
PARTITION BY toYYYYMM(timestamp)
ORDER BY (experiment_id, macro_id, timestamp, raw_id, macro_filename)
SETTINGS non_replicated_deduplication_window = 10000
