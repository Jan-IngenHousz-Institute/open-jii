-- Rows the store refused, each with the error that refused it, so the rest of their batch still lands.
CREATE TABLE IF NOT EXISTS feed_rejects
(
    source_table LowCardinality(String),
    commit_version Nullable(Int64),
    code Int32,
    message String,
    row String CODEC(ZSTD(3)),
    rejected_at DateTime64(6, 'UTC') DEFAULT now64(6)
)
ENGINE = MergeTree
ORDER BY (source_table, rejected_at)
TTL toDateTime(rejected_at) + INTERVAL 90 DAY
SETTINGS non_replicated_deduplication_window = 10000
