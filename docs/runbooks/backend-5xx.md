# backend-5xx

Backend API returning 5xx above baseline.

Likely causes: bad deploy (check deploy annotations); DB connectivity/exhausted pool; Databricks SQL warehouse outage surfacing as experiment-data errors; unhandled error in a new use case.

First moves: ECS service logs around first spike; correlate with deploy time; check new-error-codes for which AppError code moved; verify Aurora vitals.
