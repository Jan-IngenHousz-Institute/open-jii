# status-slack-errors

**Lambda gave up on a status event for the status Slack function, so a change on the public status
page never reached the status channel.** The status publisher sends each change it finds to the
`status-events-<env>` SNS topic, and this function turns each one into a Slack message and posts it to
the channel's incoming webhook. The status page itself is not affected: the data file keeps updating,
and `status-publisher-errors` and `status-publisher-stopped` watch that. The alert is not created,
and the function does not exist, in an environment that has no `STATUS_SLACK_WEBHOOK_URL`.

The alert watches `AsyncEventsDropped` in `AWS/Lambda`, which counts the events that Lambda dropped
without the function ever handling them successfully
([AWS: asynchronous invocation metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics-types.html#async-invocation-metrics)).
SNS invokes the function asynchronously, and Lambda tries a failed message twice more, a minute and
then two minutes later. It drops the message after the last try, and it also drops one that is more
than an hour old. The alert fires on any dropped event in the last hour, so a failure that a retry
recovers stays quiet, and it clears about an hour after the last drop. The function's `Errors` metric
counts every failed try, which is why it is not the signal. The channel misses a dropped event until
someone posts it by hand (see the last section).

The function also skips an event whose `id` it already posted, so a repeat that SNS or the publisher
sends is not posted twice. It remembers the last 500 ids per instance in memory. Reserved
concurrency is one, so most repeats reach the same warm instance, but an instance that started
since the first post has forgotten it. This is best effort, and the channel can show an event twice.

## Read what it said

```bash
aws logs tail /aws/lambda/<env>-status-slack --since 3h --filter-pattern '"error"'
```

Each failed attempt logs one JSON line with the `error`, the SNS `messageId` and the `message`, which
is the whole status event. Events hold only what the public page already shows, which is why they
are logged. A message longer than 20,000 characters is cut, and then it cannot be replayed. A
successful post logs `{"posted": "<event type>", "id": "<event id>"}`, and a repeat that was skipped
logs `{"skipped": "<event type>", "id": "<event id>", "reason": "already posted"}`.

## What usually causes it

- **Slack answered with an HTTP error.** The `error` reads `Slack answered <status>: <text>`. The
  text is Slack's own reason:
  - `no_service`, `no_active_hooks`, `invalid_token`, `no_service_id` or a `404` mean the webhook was
    revoked, disabled or deleted. Slack also revokes webhooks that it finds leaked in public. The app
    was probably removed or reinstalled, or the webhook was regenerated. Create a new webhook and
    follow "Replace the webhook" below.
  - `channel_is_archived`, `channel_not_found` or `user_not_found` mean the channel the webhook posts
    to was archived, renamed away or deleted. Unarchive it, or add a new webhook for the new channel.
  - `action_prohibited`, `posting_to_general_channel_denied`, `no_team` or `team_disabled` mean a
    Slack administrator restricted posting, or the workspace is not active. Ask the workspace
    administrator.
  - `invalid_payload` or `no_text` mean Slack refused the message itself, which is a bug in
    `packages/monitoring/src/status-slack.ts`. The `message` in the log is the event that produced
    it. Replay it after the fix.
  - A `429` or a `5xx` is Slack throttling or failing on its side, and usually passes by the next try.
    If it keeps happening, check https://status.slack.com.
- **Slack could not be reached.** The `error` reads `Slack could not be reached` and ends with a
  network code or `The operation was aborted due to timeout`. The request gives up after 10 seconds.
  Nothing in the function's role or the secret needs fixing, and the next try usually succeeds.
- **The secret cannot be read.** `openjii-status-slack-<env>` is read from Secrets Manager on the
  first message of each function instance, then again after 15 minutes and after any failed post.
  `AccessDeniedException` means the role lost `secretsmanager:GetSecretValue` on it, and
  `ResourceNotFoundException` means the secret was deleted or `STATUS_SLACK_SECRET_ARN` is stale.
  Applying the environment restores both. An error saying the secret does not hold an https address
  means the stored value was edited by hand, or the GitHub secret `STATUS_SLACK_WEBHOOK_URL` held
  something else. The value must be the bare webhook address, not JSON.
- **The event is malformed.** A `SyntaxError` from reading the message, or a schema error listing the
  fields, means the message on the topic is not a status event this bundle understands. A hand
  publish to the topic does this. So does a publisher newer than this function: when the event
  contract in `packages/monitoring/src/status-events.ts` changes, rebuild this function's bundle as
  well as the publisher's, because each carries its own copy. Retrying never helps, so the three
  tries all fail.
- **A deploy shipped a stale bundle.** A `Cannot find module` error means `function.zip` was built
  before `@repo/monitoring` changed. Rebuild it with `pnpm turbo run build --filter=@repo/monitoring`
  and then `npm run build` in `infrastructure/modules/monitoring/status-slack/lambda`.
- **A timeout.** The function is cut off at 30 seconds, and the webhook request and the secret read
  give up after 10 seconds each, so `Task timed out` in the log needs a closer look at what else it
  waited on.

## Replace the webhook

1. In the Slack app that owns the webhook, open Incoming Webhooks and add a webhook for the status
   channel. Copy its address.
2. Put the address in the GitHub secret `STATUS_SLACK_WEBHOOK_URL` for the affected environment, then
   run the tofu workflow for it. The apply writes the new value into `openjii-status-slack-<env>`.
3. To restore the channel before the apply, write the secret by hand with
   `aws secretsmanager put-secret-value --secret-id openjii-status-slack-<env> --secret-string file://webhook.txt`,
   where `webhook.txt` holds only the address, and delete the file afterwards. Do the GitHub secret
   as well, or the next apply puts the old address back. The function reads the secret again after
   its next failed post, so no deploy is needed.

## Post a missed message by hand

Look in the channel first. A failed try can succeed on a later one, and the command below leaves
those out, but the channel is the authority.

The simplest way is to replay the events through the function, which reads the webhook from its own
secret so the address never reaches a shell. The function logs each failed try with the whole event
and each successful post with its id. The command below reads both since `<start>`, a time in
epoch milliseconds, and keeps the events that have no `posted` line, once each and oldest first:

```bash
aws logs filter-log-events --log-group-name /aws/lambda/<env>-status-slack \
  --filter-pattern '?error ?posted' --start-time <start> --output json \
  | jq '[.events[].message | sub("^[^{]*"; "") | try fromjson catch empty] as $lines
        | [$lines[] | select(.posted != null) | .id] as $posted
        | [$lines[] | select(.message != null) | .message | try fromjson catch empty]
        | map(select(.id as $id | $posted | index($id) | not))
        | unique_by(.id) | sort_by(.occurredAt)' > events.json
```

A log line starts with a timestamp, a request id and a level, so the `sub` cuts everything before the
first `{`. Open `events.json` and check that these are the events you mean, then wrap each one the
way SNS does and invoke the function with it:

```bash
jq -c '.[]' events.json | while IFS= read -r event; do
  jq -n --arg message "$event" '{Records: [{Sns: {MessageId: "by-hand", Message: $message}}]}' > sns.json
  aws lambda invoke --function-name <env>-status-slack --cli-binary-format raw-in-base64-out \
    --payload file://sns.json /dev/stdout < /dev/null
done
```

The function runs one at a time, so Lambda answers `TooManyRequestsException` while a message is in
flight. Wait a few seconds and invoke that event again. A reply without `FunctionError` means the
post succeeded, and the channel shows it. If the function logs `skipped` for an event, that instance
already posted it, so look in the channel before changing the `id` in `events.json` to post it again.
Delete `events.json` and `sns.json` afterwards.

When the log line is gone or was cut, write the message in the channel yourself, in the same words
the function uses:

> **Incident opened: Measurements are not reaching the platform**
> Impact: outage. Affects Data intake. Started Tuesday, November 3, 2026, 11:00 UTC.
> **Investigating** (posted Nov 3, 2026, 11:55 UTC) We are looking into it. Next update by Nov 3, 2026, 12:30 UTC.
> https://status.openjii.org

Copy the title, impact, components and update from the page or from Contentful. Times are UTC.
