-- Gold's experiment_raw_data, one row per measurement. ReplacingMergeTree keeps the newest commit of a
-- row that gold sends again; the versions are gold's own, so a recreated gold table, whose versions
-- restart, needs this table emptied before it feeds it. Ids are 32-bit hashes until row ids land, so
-- the key leads with the experiment and time, where two measurements sharing an id is all but
-- impossible.
CREATE TABLE IF NOT EXISTS measurements
(
    experiment_id String,
    id Int64,
    device_id Nullable(String),
    client_id Nullable(String),
    device_name Nullable(String),
    device_family LowCardinality(Nullable(String)),
    device_version LowCardinality(Nullable(String)),
    device_firmware LowCardinality(Nullable(String)),
    device_battery Nullable(Float64),
    device_address Nullable(String),
    client_model LowCardinality(Nullable(String)),
    client_manufacturer LowCardinality(Nullable(String)),
    client_os LowCardinality(Nullable(String)),
    client_os_version LowCardinality(Nullable(String)),
    client_app_version LowCardinality(Nullable(String)),
    timestamp DateTime64(6, 'UTC'),
    timezone LowCardinality(Nullable(String)),
    measurement_time_local Nullable(String),
    macros Array(Tuple(id Nullable(String), name Nullable(String), filename Nullable(String))),
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
    user_id Nullable(String),
    protocol_id Nullable(String),
    workbook_run_id Nullable(String),
    workbook_version_id Nullable(String),
    macro_context Nullable(String),
    latitude Nullable(Float64),
    longitude Nullable(Float64),
    data Nullable(String) CODEC(ZSTD(3)),
    output_data Nullable(String) CODEC(ZSTD(3)),
    sensor_par Array(Float64),
    sensor_temperature Array(Float64),
    sensor_humidity Array(Float64),
    sensor_pressure Array(Float64),
    sensor_light_intensity Array(Float64),
    sensor_thickness Array(Float64),
    processed_timestamp Nullable(DateTime64(6, 'UTC')),
    arrival_timestamp Nullable(DateTime64(6, 'UTC')),
    skip_macro_processing Nullable(Bool),
    _commit_version Int64,
    _commit_timestamp DateTime64(6, 'UTC'),
    inserted_at DateTime64(6, 'UTC') DEFAULT now64(6),
    -- The feed's lag check reads the last few minutes' rows once a minute; this skips the rest.
    INDEX recent_inserts inserted_at TYPE minmax GRANULARITY 1
)
ENGINE = ReplacingMergeTree(_commit_version)
PARTITION BY toYYYYMM(timestamp)
ORDER BY (experiment_id, timestamp, id)
SETTINGS non_replicated_deduplication_window = 10000
