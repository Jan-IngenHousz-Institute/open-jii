-- The rows of the experiments' metadata sheets, which the feed sends from the lakehouse's copy of the
-- sheets (centrum.experiment_custom_metadata) so a store read can join custom metadata. One row per
-- identifier a sheet matches readings by, the first of the sheet's rows that holds it. match_on is
-- the question whose answer is the identifier, or column:device_id; fields holds the row's other
-- values as a JSON object, as Spark writes them.
--
-- The copy changes and deletes sheets in place, so unlike gold's rows these can go: an identifier an
-- edit dropped, or every identifier of a deleted sheet, arrives as a row with is_deleted = 1 at the
-- commit that removed it, which FINAL leaves out.
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
    inserted_at DateTime64(6, 'UTC') DEFAULT now64(6)
)
ENGINE = ReplacingMergeTree(_commit_version, is_deleted)
ORDER BY (experiment_id, sheet_id, identifier);

CREATE VIEW IF NOT EXISTS experiment_metadata_rows DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT sheet_id, sheet_created_at, match_on, identifier, fields FROM metadata_rows FINAL WHERE experiment_id = {experiment:String};
