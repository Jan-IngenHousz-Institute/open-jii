# sandbox-errors

**Sandbox invocations are crashing.** This counts Lambda's `Errors`: an invocation that ran out of
memory, hit the function's own timeout, or was killed. A macro's own mistake is not one of them: each
handler catches it and returns it as that item's result, so a macro that raises shows in the macro's
results (see `macro-failures`), never here. Errors here therefore mean the runtime itself failed, for
every macro in the batch.

## Which runtime, and since when

```bash
aws logs tail /aws/lambda/macro-sandbox-<runtime>-<env> --since 1h --filter-pattern "?ERROR ?Task ?Runtime"
```

The runtimes are separate functions, so start with whichever the alert named. The handlers do not log
macro ids, so tie an error to a macro through the time and the backend's macro batch logs.

## Platform-shaped causes

**A runtime image regression.** If the errors began with a `macro-sandbox` deploy and affect every
macro in one language while other languages are fine, that is the image.

**Concurrency exhaustion.** The pipeline executes macros in batches during enrichment, which can
saturate reserved concurrency and cause throttles rather than errors. This alert watches Errors
only; throttles have their own rule and their own tile on the daily report, and a different fix.

**Input that grew.** A batch that ran yesterday and runs out of memory or time today on unchanged
code means its input grew, such as longer traces from a new protocol. That points at the data, not
the sandbox.

## Closing

Note the runtime and the cause. A batch that runs out of memory again after a fix points at a macro
whose input or output grew, which its author can fix more cheaply than the sandbox can absorb.
