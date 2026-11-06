# status-slack

Posts the public status page's changes to a Slack channel. The Lambda subscribes to the `status-events-<env>` SNS topic that the [status publisher](../status-publisher/README.md) owns. Each message on the topic is one status event as JSON. The Lambda validates it against `statusEventSchema`, turns it into a Slack message with `slackMessage`, and posts that to an incoming webhook.

Messages are flat, one per event, and never edited or deleted. An edit to a Contentful entry that was already announced is not posted again, so the channel carries what was written and what was measured when it changed, and the page carries the current state.

| Input                | What it is                                                             |
| -------------------- | ---------------------------------------------------------------------- |
| `environment`        | Deployment environment, used in resource names                         |
| `events_topic_arn`   | ARN of the SNS topic the status publisher posts events to              |
| `webhook_secret_arn` | Secret whose value is the Slack incoming webhook address as plain text |
| `log_retention_days` | CloudWatch log retention, 30 days by default                           |

| Output          | What it is                                                  |
| --------------- | ----------------------------------------------------------- |
| `function_name` | The Lambda, which the dashboard module's error rule watches |

The `function_name` output feeds the dashboard module, whose `Status Slack Messages Dropped` rule watches the function's `AsyncEventsDropped` metric. See [`docs/runbooks/status-slack-errors.md`](../../../../docs/runbooks/status-slack-errors.md).

## Off by default

The environments create this module and its secret only when the `status_slack_webhook_url` variable is not empty. It is passed from the GitHub secret `STATUS_SLACK_WEBHOOK_URL` as `TF_VAR_status_slack_webhook_url`, so an environment whose secret is unset creates nothing and the topic simply has no subscriber. The one-time setup is in [`status-page-incidents.md`](../../../../docs/runbooks/support/status-page-incidents.md#slack).

`pr.yml` plans production with the `prod-plan` GitHub environment, not `prod`, so `STATUS_SLACK_WEBHOOK_URL` must exist there too. Without it, a pull request plan reads an empty address and shows the Slack resources being destroyed. The secret module is created with a recovery window of zero days, so clearing the variable and setting it again within a week does not fail on a name scheduled for deletion.

## A message

1. SNS invokes the function with the message. Reserved concurrency of one posts them one at a time, which keeps them roughly in order. It does not guarantee the order, because Lambda retries a failed or throttled message later than the ones behind it.
2. The function parses the message. A message that is not a status event throws. An event whose `id` this instance already posted is logged as skipped and not posted again.
3. It reads the webhook address from the secret and keeps it in memory between warm invocations. It reads it again after 15 minutes and after any failed post, so a rotated secret is picked up.
4. It builds the Slack message and posts the JSON with a 10 second timeout. Any answer other than 2xx throws, with Slack's status and reason in the error.
5. After a successful post it remembers the event's `id`, keeping the last 500.

The skip is best effort. Only the instance that posted an event remembers it, and reserved concurrency of one means most repeats from the publisher or from SNS reach that same warm instance, but a cold start forgets, so an event can occasionally post twice. An id is recorded only after a successful post, so a retry of a failed event still posts.

A thrown error makes Lambda try the message twice more, a minute and two minutes later, and drop it after that. An event that is more than an hour old is dropped too. Lambda counts each dropped event in `AsyncEventsDropped`, which the alert watches. Each failed attempt logs the whole event, which holds only what the public page shows, so the runbook can replay it by hand.

The role may call `secretsmanager:GetSecretValue` on the webhook secret only, and write to its own log group. It holds no `sns` or `kms` permission, because SNS invokes the function through the function's resource policy.

## Where the code lives

`lambda/index.js` is the handler only: the secret read and the webhook request. The message itself, including the English component names, the stage names, the escaping that Slack's markup needs and the cut that keeps a section under Slack's limit of 3000 characters, lives in `packages/monitoring/src/status-slack.ts` with vitest coverage. The handler requires it from `./lib`, a copy of that package's compiled output.

## Build

```bash
pnpm turbo run build --filter=@repo/monitoring   # refresh dist/ first
cd infrastructure/modules/monitoring/status-slack/lambda && npm run build
```

The compiled package is copied into every Lambda bundle, so a change to `packages/monitoring` means rebuilding all five bundles listed in `BUNDLE_DIRS` in `.github/workflows/pr.yml`.
