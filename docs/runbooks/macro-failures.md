# macro-failures

**Macro results are being written with errors the platform caused, not the macros.** A failed macro
still commits its result row, with the reason in `macro_error` and no output, so the backlog stays
at zero and nothing else notices. The heartbeat export sorts every error by what wrote it: the macro
itself (`Cause` macro), a run with nothing to run on (input), or the pipeline, the backend or the
sandbox on the way (platform). This alert watches platform only, two half hours in a row.

## Which layer

The error's opening names the layer. List the last hour's errors:

```sql
SELECT left(macro_error, 60) AS error, count(*) AS rows, count(DISTINCT experiment_id) AS experiments
FROM <catalog>.centrum.experiment_macro_data
WHERE processed_timestamp > current_timestamp() - INTERVAL 1 HOUR
  AND macro_error IS NOT NULL
GROUP BY 1
ORDER BY rows DESC
```

| The error begins with                                                                                 | What failed                                                | Look at                                                 |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `Chunk failed:` with `Response status: 401`                                                           | The backend's guard rejected the pipeline's call           | `webhook-failures`, which names the reason              |
| `Chunk failed:` with `Response status: 403`                                                           | The backend's WAF blocked the call before the guard saw it | The WAF's blocked requests for the backend              |
| `Chunk failed:` with a 5xx status or none                                                             | The backend failed or was unreachable, after two retries   | `backend-5xx` and `api-hosts-unhealthy`                 |
| `Lambda function error:`, `Handler error:`, `Wrapper returned`, `Invalid Lambda response payload`     | The sandbox crashed or answered with something unreadable  | `sandbox-errors`, and whether a sandbox deploy lines up |
| `No result returned for item`, `Backend API error:`, `Unknown error`, `Lambda response did not match` | The backend answered without that row's result             | The backend's logs for the macro batch route            |

A raw AWS error from invoking the sandbox, such as a throttle, has no fixed text, so it counts under
the macro's own errors. `sandbox-throttles` watches for those.

Rows already written keep their error: fixing the cause only helps the rows that arrive afterwards.

## Macros failing on one protocol

`Macros failing on one protocol` on the daily report counts macros that fail on one protocol over the
last day while working on another. That is the macro not reading what the protocol produces, so it is
for the macro's author rather than for whoever is on call, and it raises no alert. The heartbeat file
names each pair with its attempts, failures and first error:

```bash
prefix=s3://open-jii-heartbeat-<env>/heartbeat/$(date -u +%Y/%m/%d)/
aws s3 cp "$prefix$(aws s3 ls "$prefix" | tail -1 | awk '{print $4}')" - | grep macro_protocol_failures
```

## Closing

Do not close until a half hour reports no platform failures.
