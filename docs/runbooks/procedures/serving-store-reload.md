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
row gold holds at V as a commit at V. Then it deletes the store's rows from versions before V. The
store keeps each row's newest commit, so an experiment reads whole throughout. Rows the live feed
writes meanwhile carry later versions and stay. Sending a row twice does no harm, because each chunk
carries a dedup token and the store folds rows that share a key into one.

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

It connects as `openjii_reloader`, which may read and insert in `store` and delete from the three
tables it reloads, but cannot update their values, truncate a table, delete from `feed_rejects`, or
write to the migration ledger.

## Running it

Run it once the feed is on and has caught up: `store-feed-latency` is quiet, and no sink is working
through old commits after being switched on or reset (`store-feed-stalled`). In that order no gold
commit falls between the two: the feed sends everything from its start version on, and the reload
everything gold holds at a version at least as late. For a new store, as on prod's first rollout,
switch the feed on first and reload `all` once it has caught up.

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

The cluster takes a few minutes to start. Each table's result is one line of the task's output:

`[serving store] Reloaded <table> at gold version <V>: <n> rows sent, <n> refused (in feed_rejects); <n> rows in gold and <n> in the store over <n> experiments, <n> of them written by the feed since`

## When it fails

- **The store refused rows.** Follow `store-feed-rejects` to find and fix them, then run it again.
- **The store lacks gold's rows.** Run it again for the experiments the error names.
- **The store holds rows from before the version.** Wait until the feed has caught up, then run it
  again for the same experiments; the new delete takes them.
- **The store holds a version newer than gold's.** Gold's table was recreated and its versions
  restarted, so the load's rows would lose to the old ones. As the admin, empty the store table with
  `TRUNCATE TABLE store.<table>` (never `DELETE`; `store-feed-stalled` says why). Then set the feed's
  start version to gold's latest and reset its checkpoint as `store-feed-stalled` describes, and once
  the feed has caught up, reload that table for `all`.
- **Neither gold nor the store holds the experiment.** The run succeeds and says so. Unless the
  experiment was deleted, check its id.
- **Rows not sent after six attempts.** The store could not take the load; `store-answers` and
  `store-memory` cover why. Run it again once the store answers: the dedup tokens drop what already
  landed.
