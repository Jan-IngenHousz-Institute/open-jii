# metrics-mv-freshness

**The public metrics tables are stale, and the landing page is showing old numbers to the public.**
The value is minutes since `computed_at` on the metrics tables, read from the tables themselves
rather than from pipeline run state, so a pipeline that runs but writes nothing still reports as
stale, which is the case run state would miss.

This is the one metric in the program whose failure is externally visible. Treat it accordingly.

## Check upstream before touching the metrics pipeline

The metrics pipeline reads centrum. If `gold-materialization-age` or `ingest-lag` is also firing,
this is downstream of them and will recover when they do. Fix the top of the chain.

## Then the metrics pipeline itself

`Metrics-DLT-Pipeline-<ENV>`, triggered by `Metrics-Pipeline-Scheduler-<ENV>` every fifteen minutes.
Read the last update.

A failure in any one flow can hold back the whole update, which is why the ops tables in that
pipeline are deliberately written to avoid failing expectations: a monitoring flow must not be able
to take the public page down with it. If an ops flow is what failed, that is a bug in the flow and
the right immediate action is to disable it rather than to retry.

## What the public sees meanwhile

The backend caches the snapshot for a fixed time. Inside that window the page keeps rendering
numbers as old as this metric says. Once it lapses with the warehouse still down, the endpoint
returns an empty snapshot and the page renders with no numbers at all; there is no stale-on-error
fallback. That is the point at which this stops being a data-freshness incident and becomes a
visible outage, so escalate accordingly.

## Closing

Confirm `computed_at` has advanced, not merely that the pipeline reported success. A successful
update that wrote nothing is exactly the state this metric exists to catch, and the two look
identical in run history.
