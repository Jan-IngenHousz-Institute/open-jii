# store-feed-stalled

**Gold gained measurements or macro results in its newest half hour and the serving store took none
of them in 105 minutes, or the store's feed timer has sent nothing for five minutes.** Until the
feed moves again, the store holds data that stops at the stall.

The feed's sinks run inside the pipelines that write gold: measurements and uploads in Centrum,
macro results in the macro pipeline. Each pipeline's sinks exist only while the feed is switched
on. A timer on the store's instance counts the rows each table took every minute and reports zero
when none arrived, so its silence is the timer or ClickHouse stopping, not a quiet night.

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

| Logged                                    | Meaning                                                                  | Fix                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| code 516                                  | The writer's credentials are wrong                                       | Reapply infrastructure, which rewrites the `serving-store-<env>` secret scope; the sink reads it on every attempt |
| `no credentials from serving-store-<env>` | The scope or a key is missing                                            | Reapply infrastructure                                                                                            |
| `needs the store's migrations`            | A store table, or a column of one, that the feed's code sends is missing | Run the deploy's migration task                                                                                   |
| code 241 or 252                           | Memory, or too many parts                                                | Work `store-feed-latency` step 2                                                                                  |
| a timeout or connection error             | The store does not answer                                                | Work `store-answers`                                                                                              |

Rows the store could not read never stall the feed: they go to `store.feed_rejects`, and
`store-feed-rejects` covers them.

## Switching the feed off and on

The feed is on in an environment when `local.serving_store_feed_start_versions` in
`infrastructure/env/<env>/main.tf` holds a start version for each table, and off when it is empty;
the pipelines carry the feed's notebook and settings only while it is on. Changing it and applying
restarts both pipelines, and the feed's alerts go with the switch. When minutes matter more than a
pull request, remove the `serving_store_feed` notebook from each pipeline's source code in the
Databricks UI. That restarts the pipeline at once (3 to 7 minutes waiting for nodes) and the next
apply reverts it, so follow up in code.

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
`uploads` and `macro_results` in the map to those versions. After switching on, watch the first
batches in each pipeline's driver log (`[serving store] measurements batch 0: ... inserted`). A
first batch numbered 0 means the sink started at its start version, and rows gold gained while the
feed was off stay missing until a reload from gold exists; a higher number means it resumed from its
checkpoint. In the first two hours the stall alert can fire once if gold's newest half hour gained
rows before the start versions; it clears as soon as new rows arrive.

## Resetting a sink's checkpoint

Needed when the feed was off for more than seven days, or when a gold table was recreated (its
versions restart, so empty the store table first with `TRUNCATE TABLE store.<table>` as the admin).
Empty a store table only with `TRUNCATE`: after a `DELETE` the store still holds the dedup tokens of
the deleted rows' inserts, and drops those rows when the feed sends them again. Rows gold gained
before the new start version stay missing until a reload from gold exists.

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

## Refreshing gold

Leave the feed on. Refreshing a gold table rewrites it: its change feed carries a delete for every
old row, which the feed drops, and an insert for every row again, which the store folds into the row
it holds. That is a catch-up through the pipeline, which `store-feed-latency` may report while it
lasts. A refresh whose repair changes a column in a store table's key (its `ORDER BY` in
`packages/database/clickhouse/migrations`) leaves the old row in the store beside the new one until
a reload exists, so note such repairs. Before a full refresh of a whole pipeline, which also resets
the sinks' checkpoints, update the start versions as above.

A change feed cannot be read across a commit that renames, drops or retypes a column
([Databricks](https://docs.databricks.com/aws/en/delta/delta-change-data-feed)), so a refresh that
does that to a gold table fails its sink, and the pipeline with it (step 2). Switch the feed off
before such a refresh and migrate the store table to match. Once gold has committed again after the
refresh, set the start versions to its latest versions and reset the sinks' checkpoints as above.
The rows the refresh rewrote are not sent again, so a value it repaired reaches the store only
through a reload.

## Closing

Close once every table's rows arrive again, and name the cause: the timer, the switch, a failed
flow, or the store.
