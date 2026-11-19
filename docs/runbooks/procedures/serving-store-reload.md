# serving-store-reload

**Replaces what the serving store holds for one experiment, or for every experiment, with what gold
holds now.** The feed only sends rows gold inserts or updates, so the store needs a reload when:

- the store is new, or a store table was emptied because gold's table was recreated;
- gold removed rows, as when an experiment is deleted or a repair drops rows;
- the feed missed rows: while it was off for longer than its start versions reach, after a
  checkpoint reset, after a gold refresh that changed a key column (`store-feed-stalled`), or for
  refused rows once the feed's code can send them (`store-feed-rejects`);
- a store migration adds a column the feed fills, such as 0009's payload texts: rows written
  before it carry none, and the feed never sends them again (see "After a migration the feed
  fills").

## What it does

The job `Serving-Store-Reload-<ENV>` reads each gold table's latest version, V, and inserts every
row gold holds at V as a commit at V, with the payload schemas of those rows. Gold only appends,
so a recomputed row stands beside the one it replaced; of each store key the load sends the copy
gold processed last, by `processed_timestamp`. Copies with one processing time, and copies of an
upload row, which carry none, send any one of them. Then it deletes the store's rows and schemas from versions before V, so a field
only removed rows had leaves the page, unless a feed batch that spanned V also carried it: a batch's
schema takes its newest commit, so a second reload clears that field. The store keeps each row's newest commit, so an experiment
reads whole throughout. Rows the live feed writes meanwhile carry later versions and stay. Sending a
row twice does no harm, because each chunk carries a dedup token and the store folds rows that share
a key into one.

It then counts the rows per experiment, once per store key, since gold can hold a capture more than
once and the store folds the copies. The run fails in three cases, and its error names the
experiments:

- The store refused rows (they are in `store.feed_rejects`). Then nothing was deleted, since a
  refused row's older copy is the only one the store has.
- The store holds fewer rows at V or newer than gold holds at V. For an experiment the feed wrote
  nothing newer to during the run, this is exact. For one it did, the feed's new rows can make up
  for as many missing ones.
- The store holds rows from before V. A delete only reaches rows already in the store, so these came
  from a feed still catching up on commits before V. They are rows gold no longer holds.

A reloaded row says it arrived when gold committed V (`inserted_at`), so the feed's delivery metrics
and alerts, which read the last five minutes of arrivals, see only the rows the feed sends. When gold
committed V less than five minutes before the load, its rows count in those metrics until then, at a
delivery time near zero.

After its delete it removes the contributor and client ids that no row names any longer, such as an
erased contributor's, from the id tables the page sorts use.

`measurements_by_device`, the copy of measurements that device pages read, fills from measurements
as rows land, so a reload of measurements fills it too, and its delete takes the copy's older rows
with measurements'. `device_events` comes from silver's `clean_device_lifecycle_events`, not from
gold. Its rows belong to no experiment, so it reloads only for `all` and counts its rows per device.

It connects as `openjii_reloader`, which may read and insert in `store` and delete from the tables it
reloads (the four row tables, the device copy, `payload_schemas` and the two id tables), but cannot
update their values, delete from `feed_rejects`, or write to the migration ledger. Its right to
delete also lets it drop or detach those tables' partitions, which empties a table as `TRUNCATE`
would; ClickHouse has no narrower grant for a delete.

## Running it

Run it once the feed is on and has caught up. A quiet `store-feed-latency` does not show that, since
a stopped feed sends nothing to measure. Check it instead: the store's newest version must be at
least gold's newest commit that added rows. As the admin, `SELECT max(_commit_version) FROM
store.<table>`; in the Databricks SQL editor, `DESCRIBE HISTORY <catalog>.centrum.<gold table>`
(`experiment_raw_data`, `experiment_macro_data`, `experiment_uploaded_data` or, for device events,
silver's `clean_device_lifecycle_events`) and the newest version whose `operationMetrics` show
`numOutputRows` above 0. A feed batch writes the commits it carries in parallel, so the store's
newest version can reach gold's while that batch still writes older ones. So also check that batch
has finished. `SELECT max(inserted_at) FROM store.<table> WHERE _commit_version = <gold's newest
version>` gives when the feed landed that commit's rows, and the pipeline's driver log must show a
`[serving store] <table> batch <n>: ... inserted` line written after that time. A batch logs it only
once all its rows are in, and batches run one at a time, so a line after that time cannot be an
earlier batch's. A `writing the batch again` line instead means the batch is still writing, so wait
for the `inserted` one. Then the feed has sent every commit before the reload's, and a feed that
stopped cannot later send rows from before it, such as an experiment the reload removes. For a new
store, as on prod's first rollout, switch the feed on first and reload `all` once it has caught up.

Never run it while gold's table is being refreshed. A full refresh rewrites the table over many
commits, so at any one of them gold holds part of it, and a reload then deletes the rest from the
store. Past 1,000 such rows it stops before deleting, but below that it does not, so wait for the
pipeline's update to finish.

Reloading every experiment rewrites and recounts whole tables, which loads the store far more than
the feed does, so run that when the app's reads can wait. The rows it deletes stay on disk until
merges drop them, so a whole table needs about its own size free again (`store-disk`). Its delete and
its count may each take up to an hour; a run that times out is safe to run again.

Give the experiment's id, or `all`, and one table (`measurements`, `macro_results`, `uploads`,
`device_events`), or `all`. A run without an experiment fails rather than reloading everything.
Device events belong to no experiment: with `TABLE` set to `all`, a run for one experiment skips
`device_events`, and with `TABLE` set to `device_events`, it fails unless `EXPERIMENT_ID` is `all`.
In the Databricks UI, open the job and choose "Run now with different parameters". From a terminal:

```bash
databricks jobs list --name Serving-Store-Reload-<ENV>
databricks jobs run-now --no-wait --json '{"job_id": <job id>,
  "notebook_params": {"EXPERIMENT_ID": "<experiment id or all>", "TABLE": "all"}}'
```

A reload removes at most 1,000 rows gold no longer holds unless `ALLOW_REMOVAL` is `true`. Set it
only when those rows should go, as for an experiment gold has dropped, and only for that run.

The cluster takes a few minutes to start. Each table's result is one line of the task's output:

`[serving store] Reloaded <table> at <source table> version <V>: <n> rows sent, <n> refused (in feed_rejects); <n> rows in <source table> and <n> in the store over <n> <experiments or devices>, <n> of them written by the feed since`

## After a migration the feed fills

A migration that adds a column the feed fills leaves the column empty on every row the store
already holds, and on every row the feed writes until its pipelines run the new code. Reads that
depend on it show those rows wrong without an error: after 0009, a macro or upload row without its
payload text shows every payload cell empty, while filters and sorts on those fields still run. Go
in this order, and compare the read paths or widen a store flag only at the end:

1. Apply the store migrations with the backend deploy.
2. Deploy the data bundle, and update `Centrum-DLT-Pipeline-<ENV>` and
   `Macro-Execution-DLT-Pipeline-<ENV>`, which runs the `macro_results` sink, so every store sink
   runs the new code.
3. Check that the feed has caught up, as "Running it" describes.
4. Reload the tables the migration touched for `all`; for 0009, `macro_results` and `uploads`.
5. Merge them once, as "After a full or large reload" describes.

An environment whose feed is off, as prod's is before its first rollout, needs only its first
reload of `all`.

0010 fills `measurements_by_device` from the rows measurements already holds, as it applies, and
needs no reload for it. Its `device_events` starts empty: once silver's lifecycle events have their
change feed (step 2) and their sink is on, with `device_events` set in
`serving_store_feed_start_versions` (`store-feed-stalled`), reload `device_events` for `all`.

## After a full or large reload

A reload of `all`, or of an experiment with millions of rows, leaves each month it wrote in many
parts whose rows overlap. That includes a first load into an empty store, as on prod's first
rollout. Every read through the views then merges those parts as it reads, and ClickHouse's
background merges can leave them that way for a day or more. On dev, a 37M-row experiment's count
took 1.5 to 2.9 s in that state and 0.4 s once merged; its pages took up to twice as long.

When the run has finished, merge the tables it wrote once, as the admin, starting
`clickhouse-client` with `--receive_timeout=3600`. A merge writes each month's new part beside the
old ones before it drops them, so first check the store's disk has about the table's size free
(`store-disk`, or
`SELECT formatReadableSize(sum(bytes_on_disk)) FROM system.parts WHERE database = 'store' AND table = 'measurements' AND active`
against `SELECT formatReadableSize(free_space) FROM system.disks`):

```sql
OPTIMIZE TABLE store.measurements FINAL;
OPTIMIZE TABLE store.measurements_by_device FINAL;
OPTIMIZE TABLE store.macro_results FINAL;
OPTIMIZE TABLE store.uploads FINAL;
OPTIMIZE TABLE store.device_events FINAL;
```

Dev's measurements took about five minutes. Without the longer timeout the client gives up after
300 s while the merge carries on, so check `SELECT table, progress FROM system.merges` before
running it again. Afterwards no month before the current one holds more than one part, except
where the feed has written since; the current month keeps gaining parts from the feed, which its
own merges handle. This lists what is left:

```sql
SELECT table, partition, count() AS parts FROM system.parts
WHERE database = 'store' AND active
  AND table IN ('measurements', 'measurements_by_device', 'macro_results', 'uploads', 'device_events')
  AND partition < toString(toYYYYMM(now()))
GROUP BY table, partition HAVING parts > 1;
```

Keep this to full and large reloads. ClickHouse advises against running `OPTIMIZE` routinely
([best practices](https://clickhouse.com/docs/best-practices/avoid-optimize-final)), and a reload of
a small experiment only adds small parts, which reads handle.

## Metadata sheets

The reload copies gold only. The store's `metadata_rows` and `metadata_sheets` come from the
lakehouse's copy of the sheets, `centrum.experiment_custom_metadata`, which the backend's outbox keeps
to Postgres: the Centrum feed reads that table's change feed and sends each sheet's rows, and the
identifiers an edit dropped or a deletion removed as deleted rows, then the sheet itself with the
schema of its rows to `metadata_sheets`. Its sink starts at the latest version
(`SERVING_STORE_FEED_START_METADATA_ROWS`), so the sheets the copy held before it started are sent
only once each changes.

To fill the store the first time, or to repair it after `metadata_rows` or `metadata_sheets` was
emptied, owe every sheet to the lakehouse once, after Centrum runs the feed's sink. Each copy
rewrites its sheet, and the feed sends the sheet and its rows. From a database session:

```sql
INSERT INTO experiment_data_outbox (record_type, record_id, experiment_id, destination)
SELECT 'metadata_sheet'::experiment_data_record_type, id, experiment_id,
       'lakehouse'::experiment_data_destination FROM experiment_metadata_sheets
ON CONFLICT (record_type, record_id, destination) WHERE claimed_at IS NULL DO NOTHING;
```

Wait until `SELECT count(*) FROM experiment_data_outbox WHERE record_type = 'metadata_sheet'` reads
0, then until the feed has sent the last batch, and compare the sheets the store holds with the
sheets Postgres holds. The two counts match unless a batch went without its schemas, which
`store-feed-rejects` reports for `metadata_rows`:

```sql
-- On the store
SELECT count() FROM store.metadata_sheets FINAL;
```

```sql
-- On Postgres
SELECT count(*) FROM experiment_metadata_sheets;
```

Owing a sheet twice does no harm, since a copy writes each sheet's current state. The store keeps
no copy of annotations: a read filtered by flags takes the flagged rows from Postgres.

## When it fails

- **The store refused rows.** They also fire `store-feed-rejects`, which counts every refused row
  however it was sent. Follow it to find and fix them, then run it again.
- **The store lacks gold's rows.** Run it again for the experiments the error names.
- **The delete would remove more rows than the limit.** Nothing was deleted; the load's rows are in,
  beside the old ones. Check the experiments the error names against gold. If gold's pipeline is
  running a refresh, wait for it to finish and run again. If gold really dropped those rows, run
  again for the same experiments with `ALLOW_REMOVAL` set to `true`.
- **The store holds rows from before the version.** Wait until the feed has caught up, then run it
  again for the same experiments; the new delete takes them.
- **The store holds a version newer than gold's.** Gold's table was recreated and its versions
  restarted, so the load's rows and schemas would lose to the old ones. As the admin, empty the store
  table, for measurements also `store.measurements_by_device`, and `store.payload_schemas` with
  `TRUNCATE TABLE` (never `DELETE`; `store-feed-stalled` says why). Then set the feed's start version
  to gold's latest and reset its checkpoint as `store-feed-stalled` describes, and once the feed has
  caught up, reload every table for `all`, since `payload_schemas` held every table's schemas.
- **Neither gold nor the store holds the experiment.** The run succeeds and says so. Unless the
  experiment was deleted, check its id.
- **Rows not sent after six attempts.** The store could not take the load; `store-answers` and
  `store-memory` cover why. Run it again once the store answers: the dedup tokens drop what already
  landed.
