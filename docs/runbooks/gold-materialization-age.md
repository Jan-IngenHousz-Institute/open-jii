# gold-materialization-age

**Gold has not rematerialized for noticeably longer than usual.** The value is minutes since the
newest `status_updated_at` in `centrum.experiment_status`, which only advances when the centrum
pipeline completes an update, so it is a proxy for "when did the lakehouse last finish work".

This is deviation-based rather than a fixed threshold, deliberately: how often gold rematerializes
depends on each environment's load and trigger interval, so any absolute number that is meaningful
in one environment is noise in the other. What fires is the age being far outside its own recent
pattern, which is meaningful in both.

## Distinguish it from the collector being down

If `dlt-heartbeat` is also firing, this reading is stale rather than large: the collector stopped,
so the age stopped advancing at whatever it was. Fix the collector first and re-read this
afterwards. This metric is only trustworthy while the heartbeat is arriving.

## Then it is the centrum pipeline

Open `Centrum-DLT-Pipeline-<ENV>` and read the last completed update. The usual causes are the same
short list as `ingest-lag`: a failed update, a paused pipeline, or an update that is running but
wedged on one flow.

A rise in dev overnight or at the weekend, when little data arrives, is not by itself an incident. The comparison is against
the same window on previous days, so a genuine regression shows as the age being unusual _for that
time of day_, not merely large.

## When the pipeline looks healthy

If centrum has been completing updates normally, suspect the metric's own input rather than the
pipeline. `experiment_status` is a gold table; if it stopped being written while the rest of the
pipeline succeeded, the flow that produces it is the thing to inspect, and the symptom would be
`status_updated_at` frozen while other gold tables advance.

## Closing

Confirm the age has returned to its usual band for this time of day, not merely that it fell.
