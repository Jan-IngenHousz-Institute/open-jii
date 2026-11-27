-- When each row of the experiment tables reached the store, which only moves forward: a reload
-- writes silver's commit time as inserted_at, so a reloaded row can land older than the rows already
-- held. A watcher of an experiment counts the rows that arrived since it began by this. A column
-- added with a default reads the default anew on every read of a part written before it, so the rows
-- already held are given the time the column was added, before anything reads it.
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS arrived_at DateTime64(6, 'UTC') DEFAULT now64(6);

ALTER TABLE measurements MATERIALIZE COLUMN arrived_at SETTINGS mutations_sync = 2;

ALTER TABLE measurements ADD INDEX IF NOT EXISTS recent_arrivals arrived_at TYPE minmax GRANULARITY 1;

ALTER TABLE measurements MATERIALIZE INDEX recent_arrivals SETTINGS mutations_sync = 2;

ALTER TABLE macro_results ADD COLUMN IF NOT EXISTS arrived_at DateTime64(6, 'UTC') DEFAULT now64(6);

ALTER TABLE macro_results MATERIALIZE COLUMN arrived_at SETTINGS mutations_sync = 2;

ALTER TABLE macro_results ADD INDEX IF NOT EXISTS recent_arrivals arrived_at TYPE minmax GRANULARITY 1;

ALTER TABLE macro_results MATERIALIZE INDEX recent_arrivals SETTINGS mutations_sync = 2;

ALTER TABLE uploads ADD COLUMN IF NOT EXISTS arrived_at DateTime64(6, 'UTC') DEFAULT now64(6);

ALTER TABLE uploads MATERIALIZE COLUMN arrived_at SETTINGS mutations_sync = 2;

ALTER TABLE uploads ADD INDEX IF NOT EXISTS recent_arrivals arrived_at TYPE minmax GRANULARITY 1;

ALTER TABLE uploads MATERIALIZE INDEX recent_arrivals SETTINGS mutations_sync = 2;
