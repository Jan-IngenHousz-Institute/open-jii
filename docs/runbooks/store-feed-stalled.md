# store-feed-stalled

**Gold gained measurements or macro results in its newest half hour and the serving store took none
of them in 105 minutes, or the store's feed timer has sent nothing for five minutes.** Until the
feed moves again, the store holds data that stops at the stall.

The feed's sinks run inside the pipelines that write gold: measurements, uploads and silver's device
lifecycle events in Centrum, macro results in the macro pipeline. Centrum also sends the metadata
sheets and their rows, from the backend's copy of the sheets rather than from gold. Each sink
exists only while the feed is switched on and its own start version is set. A timer on the store's
instance counts the rows each table took every minute and reports zero when none arrived, so its
silence is the timer or ClickHouse stopping, not a quiet night. Device events have no stall alert,
since no heartbeat counts silver's events: a stall there shows only as `store-feed-latency` once
events arrive again.

The pipelines' logs are in `/Volumes/<catalog>/centrum/pipeline-logs/<centrum|macro>/<cluster id>/`,
the driver's under `driver/` and the executors' under `executor/`. Every line the feed writes starts
with `[serving store]`.

## Work the chain in order

**1. Is the timer reporting?** For "Serving Store Feed Timer Silent", and whenever `store-answers`
fires too, start here; for the stall alert, skip to step 2. Find the instance and open a session:

```bash
aws ec2 describe-instances --filters Name=tag:Name,Values=openjii-serving-store-<env> \
  --query 'Reservations[].Instances[].[InstanceId,State.Name]' --output text
aws ssm start-session --target <instance-id>
systemctl list-timers openjii-feed-metrics.timer
sudo journalctl -u openjii-feed-metrics --since "30 minutes ago"
```

A run that fails names its error: ClickHouse not answering is `store-answers`, a missing
`store.<table>` means the migrations have not run, and a `put-metric-data` error is the instance's
role or network.

**2. Are the feed's flows running?** In each pipeline's event log, the flow
`serving_store_<table>_changes` should be RUNNING. A flow that FAILED three times fails the whole
update and stops the pipeline's ingestion too, with the error in the event. Errors in reading
gold's change feed (`DELTA_...`) come before the sink's own code, and the usual one is a start
version or a checkpoint older than gold keeps its files (see below). Switch the feed off to bring
ingestion back, then fix the cause.

**3. Is the sink waiting on the store?** A sink whose batch the store will not take logs it on the
driver, `[serving store] measurements batch 812: 4000 rows not sent, writing the batch again in 60 s`,
and the reason on the executors, `[serving store] Insert into measurements failed on attempt 5, ...`
or `[serving store] Handing 4000 rows of measurements back: ...`.

| Logged                                    | Meaning                                                                  | Fix                                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| code 516                                  | The writer's credentials are wrong                                       | Pass the writer's stored password to the scope and the store again, below; the sink reads it on every attempt |
| `no credentials from serving-store-<env>` | The scope or a key is missing                                            | Reapply infrastructure for `url` and the usernames; a missing `writer-password` is passed again, below        |
| `needs the store's migrations`            | A store table, or a column of one, that the feed's code sends is missing | Run the deploy's migration task                                                                               |
| code 241 or 252                           | Memory, or too many parts                                                | Work `store-feed-latency` step 2                                                                              |
| a timeout or connection error             | The store does not answer                                                | Work `store-answers`                                                                                          |

OpenTofu no longer writes the writer's password. To pass the one in its secret to the scope and the
store again, without changing it. When the secret holds no password, `jq -e` prints nothing, and the
command refuses the empty input rather than set the text `null`:

```bash
aws secretsmanager get-secret-value --profile openjii-<env> --region eu-central-1 \
  --secret-id openjii-serving-store-<env>-writer --query SecretString --output text |
  jq -er '.password | select(type == "string" and length > 0)' |
  pnpm secrets:set <env> serving-store-writer --key password
```

Code 516 can also follow a restart of the store while Secrets Manager could not be read. ClickHouse
then starts on the previous passwords file, so a password rotated since is refused. The journal
shows it, and the command above installs the current file:

```bash
aws ssm start-session --profile openjii-<env> --region eu-central-1 --target <instance-id>
sudo journalctl -u clickhouse-server | grep 'Keeping the last good passwords file'
```

Rows the store could not read never stall the feed: they go to `store.feed_rejects`, and
`store-feed-rejects` covers them.

## Switching the feed off and on

The feed is on in an environment when `local.serving_store_feed_start_versions` in
`infrastructure/env/<env>/locals.tf` holds a start version for each table, and off when it holds
none; the pipelines carry the feed's notebook and settings only while it is on. Only `device_events`
may be left empty while others hold a version, which keeps its own sink off. Every other table needs
its start version once the feed is on: one left empty fails the pipeline whose sink reads it at
start, ingestion included, which is Centrum for `measurements`, `uploads` and `metadata_rows` and
the macro pipeline for `macro_results`. Changing it and applying restarts both pipelines, and the
feed's alerts go with the switch. When minutes matter more than a pull request, remove the
`serving_store_feed` notebook from each pipeline's source code in the Databricks UI. That restarts
the pipeline at once (3 to 7 minutes waiting for nodes) and the next apply reverts it, so follow up
in code.

A start version is the gold version a sink starts at when its checkpoint is new: the first time the
feed runs in an environment, and after a checkpoint reset or a full refresh of the whole pipeline.
Databricks does not document whether a sink's checkpoint outlasts the feed being off, so switch it
back on as if for the first time. Gold keeps the files of old versions for seven days, so a start
version, or a checkpoint left off for longer than that, points at files that are gone, and the flow
fails as in step 2. Read the versions on the day they are used, on the Investigations warehouse:

```sql
DESCRIBE HISTORY open_jii_<env>.centrum.experiment_raw_data LIMIT 1
```

Repeat for `experiment_uploaded_data` and `experiment_macro_data`, and set `measurements`,
`uploads` and `macro_results` in the map to those versions. `metadata_rows` starts at `latest`:
the sheets' rows are filled by owing every sheet to the lakehouse once
([reload](procedures/serving-store-reload.md#metadata-sheets)). Device events read silver's
`clean_device_lifecycle_events`, whose change feed starts at the version that switched it on, so set
`device_events` in the map to that table's latest version, never one before it. Left empty, it keeps
the device events sink off. Device pages read from the warehouse until full reloads of
`measurements` and `device_events` have both passed, so switch the sink on and reload them, as the
[reload procedure](procedures/serving-store-reload.md#before-device-pages-read-the-store) orders it.
If either had passed before the feed went off, first run
`DELETE FROM store.completed_reloads WHERE table_name IN ('measurements', 'device_events')` as the
admin and wait two minutes, so device pages read the warehouse rather than a store missing the rows
gold gained meanwhile, until new reloads of both pass. After switching on, watch the first batches in
each pipeline's driver log
(`[serving store] measurements batch 0: ... inserted`). A first batch numbered 0 means the sink
started at its start version, and rows gold gained while the feed was off stay missing until a
[reload](procedures/serving-store-reload.md); a higher number means it resumed from its checkpoint.
For `metadata_rows`, a batch 0 after the feed was off means the deletions made meanwhile were
skipped, so [reset the sheets' sink](#resetting-the-sheets-sink) instead of only owing the sheets.
In the first two hours the stall alert can fire once if gold's newest half hour gained rows before
the start versions; it clears as soon as new rows arrive.

## Resetting a sink's checkpoint

Needed when the feed was off for more than seven days, or when a gold table was recreated. Its
versions then restart. For measurements or device events, first run
`DELETE FROM store.completed_reloads WHERE table_name = '<table>'` as the admin and wait two
minutes: the backend holds its readiness answer for 60 seconds after it asks, and a page read can
take 30 seconds more. Device pages then read the warehouse until a new reload of the table passes,
rather than an emptied table. Then empty the store table with `TRUNCATE TABLE store.<table>` as the
admin, for measurements also `store.measurements_by_device`, which holds the same versions, and
`TRUNCATE TABLE store.payload_schemas`, whose schemas carry the same versions. Left behind, either
keeps a reload from running. Empty a store table only with `TRUNCATE`: after a `DELETE` the store
still holds the dedup tokens of the deleted rows' inserts, and drops those rows when the feed sends
them again. `payload_schemas` holds every table's schemas, so once the feed has caught up,
[reload](procedures/serving-store-reload.md) every table for `all`; that also brings back the rows
gold gained before the new start version. This clears neither of the sheets' tables, so reset
`metadata_rows` as in [Resetting the sheets' sink](#resetting-the-sheets-sink) instead. For
`device_events`, which has no payload schemas, empty only `store.device_events`, set its start
version to silver's latest, and once the feed has caught up, reload `device_events` for `all`.

1. Put the new start version in the map and apply. The pipelines restart; the old checkpoint still
   wins.
2. In the Databricks UI, switch the pipeline to triggered and start one update that resets the
   flow's checkpoint, by its full name:

   ```bash
   databricks pipelines start-update <pipeline-id> \
     --json '{"reset_checkpoint_selection": ["open_jii_<env>.centrum.serving_store_<table>_changes"]}'
   ```

   Ingestion pauses for that update. Production mode retries a failed reset in a loop, so stop the
   pipeline if it fails.

3. Switch the pipeline back to continuous.

## Resetting the sheets' sink

Needed when `metadata_rows`' checkpoint starts again: after the feed was off, or when
`centrum.experiment_custom_metadata` was recreated. Its sink starts at `latest`, so it never sees a
sheet deleted, or an identifier an edit dropped, before it started. Owing the sheets again cannot
send those deletions either, because only the sheets Postgres still holds are owed, and the store
keeps the removed rows. A recreated copy also restarts its commit versions, and under `FINAL` a
sheet's schema stored at an old, higher version beats the rebuilt one in `metadata_sheets`, while
the sheet counts still match. A complete backfill therefore clears both of the sheets' tables first:

1. Unless the sink already started again at batch 0, reset the flow's checkpoint as above, by its
   full name `open_jii_<env>.centrum.serving_store_metadata_rows_changes`, leaving `latest` in the
   map.
2. As the admin, `TRUNCATE TABLE store.metadata_rows` and `TRUNCATE TABLE store.metadata_sheets`.
   Leave `payload_schemas`, which holds none of the sheets' schemas.
3. Owe every sheet to the lakehouse again, and compare the counts, as
   [Metadata sheets](procedures/serving-store-reload.md#metadata-sheets) describes.

## Refreshing gold

Leave the feed on. Refreshing a gold table rewrites it: its change feed carries a delete for every
old row, which the feed drops, and an insert for every row again, which the store folds into the row
it holds. That is a catch-up through the pipeline, which `store-feed-latency` may report while it
lasts. A refresh whose repair changes a column in a store table's key (its `ORDER BY` in
`packages/database/clickhouse/migrations`) leaves the old row in the store beside the new one until
a [reload](procedures/serving-store-reload.md) of the experiments it touched. Before a full refresh
of a whole pipeline, which also resets the sinks' checkpoints, update the start versions as above.

A change feed cannot be read across a commit that renames, drops or retypes a column
([Databricks](https://docs.databricks.com/aws/en/delta/delta-change-data-feed)), so a refresh that
does that to a gold table fails its sink, and the pipeline with it (step 2). Switch the feed off
before such a refresh and migrate the store table to match. Once gold has committed again after the
refresh, set the start versions to its latest versions and reset the sinks' checkpoints as above.
The rows the refresh rewrote are not sent again, so a value it repaired reaches the store only
through a [reload](procedures/serving-store-reload.md).

## Closing

Close once every table's rows arrive again, and name the cause: the timer, the switch, a failed
flow, or the store.
