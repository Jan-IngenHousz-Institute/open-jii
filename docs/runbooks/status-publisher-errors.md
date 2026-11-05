# status-publisher-errors

**The status publisher threw, so the public status page's data file has stopped updating.** It runs
every minute. It requests the web app and the API, reads the load balancer, CloudFront, IoT and
Kinesis metrics, the backend's dependency checks and the pipeline heartbeat metrics from
CloudWatch, judges each component, and rewrites the data file. The page shows when it was last
checked, so a stale file shows as a stale time.

The run validates the document against its schema before it writes anything, so a run that throws
on a check, a read or the schema writes nothing and the file stays as the last good run left it. A
failed minute is not retried: the next run is a minute away and records the lost minute as unknown
time. The alert fires on more than two failed runs in five minutes, which is when the page is going
stale rather than blinking.

## Read what it said

```bash
aws logs tail /aws/lambda/<env>-status-publisher --since 30m
```

A successful run ends with a line naming each component's state and both probes. A run that threw
ends with the error instead.

## What usually causes it

- **S3 refused a read or a write.** An `AccessDenied` means the role and the buckets drifted apart.
  The function reads and writes only `publisher-state.json` in `open-jii-status-state-<env>`, and
  writes only the `data/` prefix of `open-jii-status-public-<env>`.
- **CloudWatch refused or throttled the metrics read.** `AccessDenied` on `GetMetricData` means the
  role lost it. `Throttling` passes on the next run.
- **CloudWatch could not answer a query.** The run throws when a result comes back `Forbidden` or
  `InternalError`, or still `PartialData` on the last page, and the message names the query ids and
  what CloudWatch said. Reading it as no data would have shown a quiet signal or a silent producer,
  so the run stops instead.
- **The data file failed its schema.** The publisher validates the document against
  `packages/monitoring/src/status-document.ts` before uploading, so a check that returns something
  the schema does not allow throws instead of publishing a broken file.
- **The saved state is corrupt.** The publisher carries its history between runs in
  `publisher-state.json`, and a state that no longer parses stops every run on purpose, so history
  does not silently restart. The log shows a schema error from reading it. Restore the previous
  version of the object in `open-jii-status-state-<env>`, which keeps old versions for 7 days:

  ```bash
  aws s3api list-object-versions --bucket open-jii-status-state-<env> --prefix publisher-state.json
  aws s3api get-object --bucket open-jii-status-state-<env> --key publisher-state.json \
    --version-id <version> restored.json
  aws s3api put-object --bucket open-jii-status-state-<env> --key publisher-state.json \
    --body restored.json --content-type application/json
  ```

  Take a version from before the first failed run. If every version is bad, or the history is not
  worth keeping, delete `publisher-state.json` instead and the next run starts the history over from
  that minute.

- **A timeout.** The function is cut off at 50 seconds and Lambda counts that as an error, so
  `Task timed out` in the log means a request or a metrics read hung. The probes give up after 10
  seconds and each AWS call after 10 seconds, so a run that still times out needs a closer look at
  what else it waited on.
- **A deploy shipped a stale bundle.** A `Cannot find module` error means `function.zip` was built
  before `@repo/monitoring` changed. Rebuild it with `pnpm turbo run build --filter=@repo/monitoring`
  and then `npm run build` in `infrastructure/modules/monitoring/status-publisher/lambda`.

## Running it again

After fixing the cause, run it by hand rather than waiting for the next minute:

```bash
aws lambda invoke --function-name <env>-status-publisher /dev/stdout
```

The function runs one at a time, so Lambda answers `TooManyRequestsException` while a scheduled run
is in flight. Wait a few seconds and invoke again. The rule looks back five minutes, so it clears
about five minutes after the last failed run.
