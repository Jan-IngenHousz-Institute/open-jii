# gold-materialization-age

**Gold has not received a row for noticeably longer than usual.** The value is minutes since the
newest `latest_processed_timestamp` in `centrum.experiment_status`, a view over
`experiment_raw_data`, so it is "when did the lakehouse last write a measurement to gold".

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

If centrum is running normally, check whether data is arriving at all: `ingest-idle` and the
bronze row counts show that. Gold only receives rows when devices send them, so a quiet fleet
raises this age on its own. If bronze and silver advance while `experiment_raw_data` does not,
the gold flow is the thing to inspect.

## Closing

Confirm the age has returned to its usual band for this time of day, not merely that it fell.
