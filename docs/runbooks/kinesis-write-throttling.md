# kinesis-write-throttling

IoT rule writes into Kinesis are being throttled (WriteProvisionedThroughputExceeded > 0).

Likely causes: ingest burst beyond shard capacity (new fleet or runaway device); shard count too low for grown fleet.

First moves: check kinesis-incoming for the burst shape and per-device top-N in the heartbeat S3 detail for a runaway publisher; if organic growth, scale shards in the kinesis module.
