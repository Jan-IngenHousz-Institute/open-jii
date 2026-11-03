# serving-store-reload

**Replaces what the serving store holds for one experiment, or for every experiment, with what gold
holds now.** The feed only sends rows gold inserts or updates, so the store needs a reload when:

- the store is new, or a store table was emptied because gold's table was recreated;
- gold removed rows, as when an experiment is deleted or a repair drops rows;
- the feed missed rows: while it was off for longer than its start versions reach, after a
  checkpoint reset, after a gold refresh that changed a key column (`store-feed-stalled`), or for
  refused rows once the feed's code can send them (`store-feed-rejects`).

## What it does

The job `Serving-Store-Reload-<ENV>` reads each gold table's latest version, V, and inserts every
row gold holds at V as a commit at V, with the payload schemas of those rows. Gold only appends,
so a recomputed row stands beside the one it replaced; of each store key the load sends the copy
gold added last. Then it deletes the store's rows and schemas from versions before V, so a field
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

It connects as `openjii_reloader`, which may read and insert in `store` and delete from the tables it
reloads (the three row tables and `payload_schemas`), but cannot update their values, delete from
`feed_rejects`, or write to the migration ledger. Its right to delete also lets it drop or detach
those tables' partitions, which empties a table as `TRUNCATE` would; ClickHouse has no narrower grant
for a delete.

## Running it

Run it once the feed is on and has caught up. A quiet `store-feed-latency` does not show that, since
a stopped feed sends nothing to measure. Check it instead: the store's newest version must be at
least gold's newest commit that added rows. As the admin, `SELECT max(_commit_version) FROM
store.<table>`; in the Databricks SQL editor, `DESCRIBE HISTORY <catalog>.centrum.<gold table>`
(`experiment_raw_data`, `experiment_macro_data` or `experiment_uploaded_data`) and the newest version whose `operationMetrics` show `numOutputRows` above 0. Then the feed has sent
every commit before the reload's, and a feed that stopped cannot later send rows from before it,
such as an experiment the reload removes. For a new store, as on prod's first rollout, switch the
feed on first and reload `all` once it has caught up.

Never run it while gold's table is being refreshed. A full refresh rewrites the table over many
commits, so at any one of them gold holds part of it, and a reload then deletes the rest from the
store. Past 1,000 such rows it stops before deleting, but below that it does not, so wait for the
pipeline's update to finish.

Reloading every experiment rewrites and recounts whole tables, which loads the store far more than
the feed does, so run that when the app's reads can wait. The rows it deletes stay on disk until
merges drop them, so a whole table needs about its own size free again (`store-disk`). Its delete and
its count may each take up to an hour; a run that times out is safe to run again.

Give the experiment's id, or `all`, and one table (`measurements`, `macro_results`, `uploads`), or
`all`. A run without an experiment fails rather than reloading everything. In the Databricks UI,
open the job and choose "Run now with different parameters". From a terminal:

```bash
databricks jobs list --name Serving-Store-Reload-<ENV>
databricks jobs run-now --no-wait --json '{"job_id": <job id>,
  "notebook_params": {"EXPERIMENT_ID": "<experiment id or all>", "TABLE": "all"}}'
```

A reload removes at most 1,000 rows gold no longer holds unless `ALLOW_REMOVAL` is `true`. Set it
only when those rows should go, as for an experiment gold has dropped, and only for that run.

The cluster takes a few minutes to start. Each table's result is one line of the task's output:

`[serving store] Reloaded <table> at gold version <V>: <n> rows sent, <n> refused (in feed_rejects); <n> rows in gold and <n> in the store over <n> experiments, <n> of them written by the feed since`

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
  table and `store.payload_schemas` with `TRUNCATE TABLE` (never `DELETE`; `store-feed-stalled` says
  why). Then set the feed's start version to gold's latest and reset its checkpoint as
  `store-feed-stalled` describes, and once the feed has caught up, reload every table for `all`, since
  `payload_schemas` held every table's schemas.
- **Neither gold nor the store holds the experiment.** The run succeeds and says so. Unless the
  experiment was deleted, check its id.
- **Rows not sent after six attempts.** The store could not take the load; `store-answers` and
  `store-memory` cover why. Run it again once the store answers: the dedup tokens drop what already
  landed.
