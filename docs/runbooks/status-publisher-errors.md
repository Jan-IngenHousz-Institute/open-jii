# status-publisher-errors

**The status publisher threw, so the public status page's data file may have stopped updating, or
the events it posts to subscribers may have stopped.** It runs every minute. It requests the web app
and the API, reads the load balancer, CloudFront, IoT and Kinesis metrics, the backend's dependency
checks and the pipeline heartbeat metrics from CloudWatch, reads the incidents and notices people
wrote in Contentful every five minutes and keeps the last read in between, judges each component, rewrites the data file, and posts what changed to the
`status-events-<env>` SNS topic. The page shows when it was last checked, so a stale file shows as a
stale time.

The run validates the document against its schema before it writes anything, so a run that throws on
a check, a read or the schema writes nothing and the file stays as the last good run left it. A run
that throws while sending events has already written the file, so the page is current and only the
events are late: the next run sends the same ones again. The same holds for a run that throws only
because Contentful has stayed unreadable for too long (see the last section), which writes
everything first. A failed minute is not retried: the next run is a minute away and records the lost
minute as unknown time. The alert fires when more than two runs fail in five minutes and that still
holds at the next check five minutes later, which is when the page is going stale rather than
blinking.

## Read what it said

```bash
aws logs tail /aws/lambda/<env>-status-publisher --since 30m
```

A successful run ends with a line naming each component's state, both probes and the number of
events it sent. A run that threw ends with the error instead, except one that threw only because
Contentful stayed unreadable, which logs that line first because it had written everything.

## What usually causes it

- **S3 refused a read or a write.** An `AccessDenied` means the role and the buckets drifted apart.
  The function reads and writes only `publisher-state.json` and `status-feed.json` in
  `open-jii-status-state-<env>`, and writes only `data/status.json` in `open-jii-status-public-<env>`.
- **CloudWatch refused or throttled the metrics read.** `AccessDenied` on `GetMetricData` means the
  role lost it. `Throttling` passes on the next run.
- **CloudWatch could not answer a query.** The run throws when a result comes back `Forbidden` or
  `InternalError`, or still `PartialData` on the last page, and the message names the query ids and
  what CloudWatch said. Reading it as no data would have shown a quiet signal or a silent producer,
  so the run stops instead.
- **The data file failed its schema.** The publisher validates the document against
  `packages/monitoring/src/status-document.ts` before uploading, so a check that returns something
  the schema does not allow throws instead of publishing a broken file.
- **Publishing to SNS failed.** The run throws when a `PublishBatch` call fails or reports a failed
  entry, and the message names the event ids and what SNS said. The page and the history were
  already written, so only the events are held back. The feed state is written after a successful
  send, so the next run works out the same events again and tries again, and a recovered topic
  catches up without a gap. A subscriber may see an event twice, which its `id` tells apart.
  `AccessDenied` or `AuthorizationError` means the role lost `sns:Publish` on the topic, `NotFound`
  means `STATUS_EVENTS_TOPIC_ARN` points at a topic that is gone, and `KMSAccessDeniedException`
  means the AWS managed key refused the publish. The publisher splits events into batches that
  stay under SNS's limits of ten messages and 256 KB, so a long update text does not fail a run.
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
  that minute. A release that raises `PUBLISHER_STATE_VERSION` fails the same way on its first run,
  and no older version reads either, so delete the object then.

- **The saved feed state is corrupt.** The publisher carries what subscribers were last told, and
  the last content it read from Contentful, in `status-feed.json`. A state that no longer parses
  does not stop the run: the log shows one JSON line with `"warning": "status-feed-unreadable"` and
  the error from reading it, and the run treats the state as absent. It posts nothing, records what
  the page shows now as the baseline and reads Contentful afresh, and the page keeps updating. Any
  change between the last good run and that run is never announced. If Contentful cannot be read at
  that moment, the run writes no baseline and waits for the first good read, so nothing already open
  is announced as new, and it fails as described in the last section. The warning clears by itself
  once the new state is written. To bring the old snapshot back instead, restore the previous
  version of `status-feed.json` the way the saved state is restored in the previous item; events
  since that version go out again.
- **Contentful stayed unreadable.** The run threw an error that says Contentful has been
  unreadable for some minutes, or that it is unreadable with no earlier read kept. See the last
  section.
- **A timeout.** The function is cut off at 50 seconds and Lambda counts that as an error, so
  `Task timed out` in the log means a request or a metrics read hung. The probes give up after 10
  seconds and each AWS call after 10 seconds, so a run that still times out needs a closer look at
  what else it waited on.
- **A deploy shipped a stale bundle.** A `Cannot find module` error means `function.zip` was built
  before `@repo/monitoring` changed. Rebuild it with `pnpm turbo run build --filter=@repo/monitoring`
  and then `npm run build` in `infrastructure/modules/monitoring/status-publisher/lambda`.

## When Contentful cannot be read

A failed read of Contentful does not fail the run at first. The run logs one JSON warning line and
carries on with the incidents and notices from its last good read, which `status-feed.json` keeps.
The page keeps its last notes, and no events go out for new entries until the read works again.
Look for the line when an incident or notice posted in Contentful has not shown up within a couple
of minutes:

```bash
aws logs tail /aws/lambda/<env>-status-publisher --since 30m --filter-pattern '"contentful-read-failed"'
```

Once the last good read is more than 15 minutes old, or there is none (a first run, or after the
feed state was deleted or found corrupt), the run still writes the files and sends the events, as
it does while the cache is fresh, and then throws. The error names how many minutes Contentful has
been unreadable and the time of the last good read, or says that no earlier read is kept, and gives
the cause after it. That makes the run count as failed, so this alert fires after more than two of
them in five minutes, a little over twenty minutes after Contentful went down. The page keeps serving the cached
notes meanwhile, and with no cache it shows none. No baseline is written until a read works, so
nothing already open is announced as new when it does.

The line carries the error and `cachedAt`, the time of the last good read (`null` when there is
none), which tells how stale the page's notes are. What the error says points at the cause:

- **Contentful answered with a status.** `401` means the access token was revoked or the secret
  holds a stale one; `5xx` or a timeout is Contentful's own outage and passes by itself.
- **Contentful answered with errors.** The message names what the query got wrong. A field or
  collection Contentful does not know means the `statusIncident` or `statusUpdate` content type is
  not published in the space this environment reads, or the query in
  `packages/monitoring/src/status-content.ts` and the content model drifted apart. A complexity or
  limit error means the query outgrew Contentful's cap.
- **The secret cannot be read.** `openjii-status-contentful-<env>` is read from Secrets Manager on
  the first run of each Lambda instance and again after any failed read. `AccessDeniedException`
  means the role lost `secretsmanager:GetSecretValue` on it, and `ResourceNotFoundException` means
  the secret was deleted or `STATUS_CONTENTFUL_SECRET_ARN` is stale. A message that the secret is
  not valid JSON, or lacks `CONTENTFUL_SPACE_ID` or `CONTENTFUL_ACCESS_TOKEN`, means the stored
  value was edited by hand. The environment's `main.tf` writes it from `contentful_space_id` and
  `contentful_access_token`, so applying the environment restores it.

An answer whose only errors carry the code `UNRESOLVABLE_LINK` is not a failed read. It means an
incident links an update that is unpublished, archived or deleted, so that update stays off the page
until it is published, and the run goes on with everything else. Any other error in the answer fails
the read.

The next successful read clears the warning on its own, and the events for anything that changed in
the meantime go out then.

## Running it again

After fixing the cause, run it by hand rather than waiting for the next minute:

```bash
aws lambda invoke --function-name <env>-status-publisher /dev/stdout
```

The function runs one at a time, so Lambda answers `TooManyRequestsException` while a scheduled run
is in flight. Wait a few seconds and invoke again. The rule looks back five minutes, so it clears
about five minutes after the last failed run.
