# ingest-healthcheck

Sends a synthetic message through the real ingest path every minute, so a stopped path shows at a quiet hour, when no device is publishing to show it. An EventBridge rule invokes the Lambda each minute, and it publishes one message over the IoT data plane with QoS 1:

- Topic `experiment/data_ingest/v1/healthcheck/healthcheck/1/<env>`, which the lean ingest rule in `modules/iot-core` selects, so the message takes the same two actions as a measurement, Kinesis and the raw archive.
- Payload `{"healthcheck": true, "sent_at": <epoch milliseconds>, "environment": "<env>"}`. `ingest_healthchecks` keeps a message on the topic only when it carries `healthcheck: true`.

The experiment segment, `healthcheck`, is what keeps the message out of research data. The Centrum pipeline's `raw_data` drops it by that id and `ingest_healthchecks` keeps only it, so no measurement, bronze row count or public figure includes it. The id is `INGEST_HEALTHCHECK_EXPERIMENT_ID` in `apps/data`'s centrum constants, and a test there fails if this module's topic stops carrying it.

The heartbeat export reads `ingest_healthchecks` every half hour and publishes `HealthcheckAgeMinutes` and `HealthcheckLatencyP95Seconds` to `OpenJII/Data`. Catalogue entry 132 alerts on the age, and entry 134 on this function's errors. Each environment root has two switches: `ingest_healthcheck_publishing` starts the Lambda and adds `ingest_healthchecks` to the centrum pipeline, so it is flipped in a release after the one that deployed that notebook, and `ingest_healthcheck_alerting` creates the Grafana rules once the first `HealthcheckAgeMinutes` datapoint exists, because the age rule fires on no data. See [`docs/runbooks/ingest-healthcheck-age.md`](../../../../docs/runbooks/ingest-healthcheck-age.md).

## Why it is built this way

The role may publish to exactly one topic. The function has one reserved concurrent execution, a ten second timeout and no retries, its client makes one attempt, and an event older than a minute is dropped, so a failed or delayed run shows as a missing message and never as a late one.

## Build

```bash
cd infrastructure/modules/monitoring/ingest-healthcheck/lambda && npm run build
```
