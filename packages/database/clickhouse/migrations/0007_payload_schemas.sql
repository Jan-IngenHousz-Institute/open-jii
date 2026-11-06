-- Each experiment table's payload schemas, typed as gold types them. The feed sends each batch's
-- merged schema beside its rows and the backend merges a table's schemas, so a new field shows as
-- soon as its rows do. One row per distinct schema at its newest commit, so a reload can delete the
-- schemas only rows gold no longer holds had.
CREATE TABLE IF NOT EXISTS payload_schemas
(
    experiment_id String,
    table_type LowCardinality(String),
    identifier String,
    payload LowCardinality(String),
    schema String,
    _commit_version Int64
)
ENGINE = ReplacingMergeTree(_commit_version)
ORDER BY (experiment_id, table_type, identifier, payload, schema)
SETTINGS non_replicated_deduplication_window = 10000;

CREATE VIEW IF NOT EXISTS experiment_payload_schemas DEFINER = CURRENT_USER SQL SECURITY DEFINER AS
SELECT table_type, identifier, payload, schema FROM payload_schemas FINAL WHERE experiment_id = {experiment:String};
