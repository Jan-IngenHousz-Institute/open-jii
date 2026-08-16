# metrics-forwarder

Turns the heartbeat files the Databricks job writes into CloudWatch datapoints. An S3 `ObjectCreated` notification on the heartbeat bucket (prefix `heartbeat/`, suffix `.json`) invokes the Lambda, which reads the NDJSON object and calls `PutMetricData`.

- Lines carrying a `metric` key become datapoints, published with the observation timestamp from the payload so a delayed or replayed file does not skew the series.
- Lines carrying a `detail` key are roster data left in S3 for the digest composer to read. Forwarding them would put per-experiment cardinality into CloudWatch, which the catalog's cardinality rule forbids.
- Publishing is restricted by IAM condition to the `OpenJII/Ingest`, `OpenJII/Data` and `OpenJII/Usage` namespaces.

This module also owns the IAM policy that lets the Unity Catalog storage credential write those files; attach `databricks_write_policy_arn` to the credential's `additional_policy_arns`.

## Where the code lives

`index.js` here is the handler only: S3 read, CloudWatch write. Parsing and batching live in **`packages/monitoring`**, a workspace package with vitest coverage.

The handler requires `./lib/forwarder.js` directly rather than the package barrel, because the barrel pulls in the catalog module and its `js-yaml` dependency, which this function does not ship.

## Build

```bash
pnpm turbo run build --filter=@repo/monitoring   # refresh dist/ first
cd infrastructure/modules/monitoring/metrics-forwarder/lambda && npm run build
```
