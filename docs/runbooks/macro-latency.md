# macro-latency

**Macro results are taking longer than usual to follow their measurements.** Every half hour the
heartbeat export takes the macro results committed to `experiment_macro_data` and measures, for
the slowest twentieth, how long each took from its measurement's commit in the experiment tables to
its own commit. Researchers see computed values that much later. Nothing is lost.

The limit is 300 seconds in both environments. In the week to 26 October an ordinary prod half hour
sat near 6 s, and nine in ten stayed under 25 s. It fires on two slow half hours in a row.

## First, the macro pipeline's worker

The macro pipeline runs on one spot worker. When AWS reclaims it, results pause for about ten
minutes until a replacement starts. One reclaim makes one slow half hour, which this alert lets
pass. Open `Macro-Execution-DLT-Pipeline-<ENV>`, open its cluster's event log, and look for
`NODES_LOST` with `SPOT_INSTANCE_TERMINATION`. Reclaims that keep coming are the case for keeping
that worker on demand, which means raising `first_on_demand` in `macro_cluster_policy` in
`infrastructure/env/<env>/main.tf`. That costs money, so it is the owner's call.

## Then the backend

A macro request that gets no answer, a 429 or a 5xx is retried for about five minutes before its
rows record an error, so a backend restart shows here as delay rather than as failed rows. Check
the same alert list for `backend-5xx`, `sandbox-errors` and `sandbox-throttles`.

## Then the backlog

If `macro-backlog` fires too, results are not being produced at all; follow
[macro-backlog](macro-backlog.md).

## Closing

Close once two half hours in a row are back under the limit on the daily report.
