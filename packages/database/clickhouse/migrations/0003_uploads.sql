-- Gold's experiment_uploaded_data, one row per uploaded row.
CREATE TABLE IF NOT EXISTS uploads
(
    experiment_id String,
    id Int64,
    upload_table_id String,
    upload_table_name Nullable(String),
    upload_id Nullable(String),
    created_by Nullable(String),
    uploaded_at DateTime64(6, 'UTC'),
    -- Per-row path functions such as JSONAllPaths need assumeNotNull(uploaded_data).
    uploaded_data Nullable(JSON),
    _commit_version Int64,
    _commit_timestamp DateTime64(6, 'UTC'),
    inserted_at DateTime64(6, 'UTC') DEFAULT now64(6),
    -- The feed's lag check reads the last few minutes' rows once a minute; this skips the rest.
    INDEX recent_inserts inserted_at TYPE minmax GRANULARITY 1
)
ENGINE = ReplacingMergeTree(_commit_version)
PARTITION BY toYYYYMM(uploaded_at)
ORDER BY (experiment_id, upload_table_id, uploaded_at, id)
SETTINGS non_replicated_deduplication_window = 10000
