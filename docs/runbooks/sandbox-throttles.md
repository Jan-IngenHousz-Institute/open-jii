# sandbox-throttles

**A sandbox refused runs because its reserved concurrency was full.** Each macro runtime (Python,
JavaScript and R) may run 20 at once in prod and 10 in dev; the calibration sandbox 10 and 5. Any
throttle alerts.

A throttle is not yet a lost run. The backend's Lambda client makes up to five attempts, and the
pipeline retries a failed batch after one and then four seconds. Runs are lost only when those
retries run out, which shows as macro errors or missing macro results.

## Who is calling

- **Macros.** Databricks enrichment posts batches of up to 25 rows or 4 MB to the backend, at most
  three at a time per task. The backend then invokes the runtimes for every script in a batch at
  once, in chunks of up to 6 MB, with no cap of its own. Concurrency is roughly pipeline tasks
  times three times chunks per batch.
- **Calibration.** One run per calibration request from the backend, with no batching.

## Likely causes, most common first

- **A large enrichment run.** A backfill or a big import sends many batches at once. Throttles
  clustered in a pipeline update, with every batch still completing on retry, need nothing.
- **Slower runs.** A run holds its slot for its whole duration, up to the 65-second timeout. A slow
  macro or a slower runtime image means the same load needs more slots. Macro run time on the Data
  pipeline dashboard shows it.
- **More parallelism in the pipeline.** More task slots, or a higher `MACRO_EXECUTION_PARTITIONS`
  (16 by default), multiplies the requests in flight. The client in
  `apps/data/src/lib/enrich/enrich/backend_client.py` assumes about twelve in flight against twenty
  reserved.

The fix is either side of the same sum: raise the function's reserved concurrency in
`infrastructure/env/<env>/main.tf`, which costs nothing while idle, or send fewer requests at once.

## Closing

Note the runtime and whether runs were lost or only retried.
