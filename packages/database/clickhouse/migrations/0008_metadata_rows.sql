-- The rows of the experiments' metadata sheets, which the feed sends from the lakehouse's copy of the
-- sheets (centrum.experiment_custom_metadata) so a store read can join custom metadata. One row per
-- identifier a sheet matches readings by, the first of the sheet's rows that holds it. match_on is
-- the question whose answer is the identifier, or column:device_id; fields holds the row's other
-- values as a JSON object, as Spark writes them.
--
-- The copy changes and deletes sheets in place, so unlike gold's rows these can go: an identifier an
-- edit dropped, or every identifier of a deleted sheet, arrives as a row with is_deleted = 1 at the
-- commit that removed it, which FINAL leaves out. A sheet keeps the time it was created through every
-- edit, so a row's copies always land in the same month.
CREATE TABLE IF NOT EXISTS metadata_rows
(
    experiment_id String,
    sheet_id String,
    sheet_created_at DateTime64(6, 'UTC'),
    match_on String,
    identifier String,
    fields String,
    is_deleted UInt8 DEFAULT 0,
    _commit_version Int64,
    _commit_timestamp DateTime64(6, 'UTC'),
    inserted_at DateTime64(6, 'UTC') DEFAULT now64(6),
    -- The feed's lag check reads the last few minutes' rows once a minute; this skips the rest.
    INDEX recent_inserts inserted_at TYPE minmax GRANULARITY 1
)
ENGINE = ReplacingMergeTree(_commit_version, is_deleted)
PARTITION BY toYYYYMM(sheet_created_at)
ORDER BY (experiment_id, sheet_id, identifier)
SETTINGS non_replicated_deduplication_window = 10000;

CREATE VIEW IF NOT EXISTS experiment_metadata_rows DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT sheet_id, sheet_created_at, match_on, identifier, fields FROM metadata_rows FINAL WHERE experiment_id = {experiment:String};

-- Each metadata sheet once, which the feed sends after the sheet's rows: what it matches readings by,
-- and the schema of its rows as gold's listing types custom metadata, decimals kept, NULL for a sheet
-- without rows. An experiment's sheets' schemas merge into the one gold lists for it. A deleted sheet
-- arrives with is_deleted = 1, as its rows do.
CREATE TABLE IF NOT EXISTS metadata_sheets
(
    experiment_id String,
    sheet_id String,
    sheet_created_at DateTime64(6, 'UTC'),
    match_on String,
    schema Nullable(String),
    is_deleted UInt8 DEFAULT 0,
    _commit_version Int64
)
ENGINE = ReplacingMergeTree(_commit_version, is_deleted)
ORDER BY (experiment_id, sheet_id)
SETTINGS non_replicated_deduplication_window = 10000;

CREATE VIEW IF NOT EXISTS experiment_metadata_sheets DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT sheet_id, sheet_created_at, match_on, schema, _commit_version FROM metadata_sheets FINAL WHERE experiment_id = {experiment:String};
