-- The rows of the experiment's metadata sheets, copied from Postgres by the backend's outbox so a
-- store read can join custom metadata. A copy writes a sheet's current rows, and a deleted sheet,
-- or a row an edit removed, arrives as a row with is_deleted = 1, which FINAL leaves out. So the
-- copier only ever inserts. Each copy carries the time its outbox claim was taken, on Postgres's
-- clock, as its version: a claim taken back after its lease is older than the claim that took it,
-- so a copy it lands late loses to the newer one.
--
-- One row per identifier a sheet matches readings by, the first of the sheet's rows that holds it.
-- match_on is the question whose answer is the identifier, or column:device_id; fields holds the
-- row's other values as a JSON object, numbers written as the sheet wrote them.
CREATE TABLE IF NOT EXISTS metadata_rows
(
    experiment_id String,
    sheet_id String,
    sheet_created_at DateTime64(6, 'UTC'),
    match_on String,
    identifier String,
    fields String,
    is_deleted UInt8 DEFAULT 0,
    claimed_at DateTime64(3, 'UTC')
)
ENGINE = ReplacingMergeTree(claimed_at, is_deleted)
ORDER BY (experiment_id, sheet_id, identifier);

CREATE VIEW IF NOT EXISTS experiment_metadata_rows DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT sheet_id, sheet_created_at, match_on, identifier, fields FROM metadata_rows FINAL WHERE experiment_id = {experiment:String};
