# status-publisher

Checks the platform every minute and writes the public status page's data file. An EventBridge schedule invokes the Lambda, which requests the web app and the API's health endpoint, reads the signals each component is judged on from CloudWatch, reads the incidents and notices that people wrote in Contentful, and writes three objects. `data/status.json` in the public site bucket is what the page fetches. `publisher-state.json` in a private state bucket carries each component's 90 days of history between runs. `status-feed.json` in the same bucket carries what subscribers were last told and the last content read from Contentful. When the page's state or incidents changed since subscribers were last told, the Lambda also posts each change to an SNS topic.

The function runs one at a time and does not retry a failed minute. The next run records the lost minute as unknown time.

Each run reads about twenty metrics with GetMetricData, which CloudWatch bills per metric read, so the publisher costs roughly ten dollars a month per environment at list price. Its S3 requests and Lambda time add less than a dollar.

| Input                   | What it is                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `environment`           | Deployment environment, used in resource names and as the metrics' scope                                                                       |
| `site_bucket_id`        | Public bucket the page is served from; the publisher writes `data/status.json` there                                                           |
| `site_bucket_arn`       | ARN of the public site bucket                                                                                                                  |
| `state_bucket_id`       | Private, versioned bucket holding `publisher-state.json` and `status-feed.json`                                                                |
| `state_bucket_arn`      | ARN of the state bucket                                                                                                                        |
| `web_url`               | Public https URL of a web app page that reads nothing from the backend, which the website check requests with a fresh query string each minute |
| `api_health_url`        | Public https URL of the backend's health endpoint                                                                                              |
| `load_balancer_arn`     | Backend ALB, from which the CloudWatch `LoadBalancer` dimension is derived                                                                     |
| `web_distribution_id`   | CloudFront distribution serving the web app                                                                                                    |
| `kinesis_stream_name`   | Ingest stream whose metrics the data intake check reads                                                                                        |
| `contentful_secret_arn` | Secret holding `CONTENTFUL_SPACE_ID` and `CONTENTFUL_ACCESS_TOKEN`                                                                             |
| `page_url`              | Public https URL of the status page, which published events link to                                                                            |
| `log_retention_days`    | CloudWatch log retention, 30 days by default                                                                                                   |

| Output              | What it is                                                 |
| ------------------- | ---------------------------------------------------------- |
| `function_name`     | The Lambda, which the dashboard module's alert rules watch |
| `events_topic_arn`  | ARN of the SNS topic the events are posted to              |
| `events_topic_name` | Name of that topic, `status-events-<env>`                  |

The `function_name` output feeds the dashboard module, whose `Status Publisher Errors` and `Status Publisher Stopped` rules watch the function. See [`docs/runbooks/status-publisher-errors.md`](../../../../docs/runbooks/status-publisher-errors.md) and [`docs/runbooks/status-publisher-stopped.md`](../../../../docs/runbooks/status-publisher-stopped.md).

## A run

1. In parallel, the Lambda requests the web app and the API, reads both state objects, reads CloudWatch and queries Contentful. A missing state object means a first run. A `publisher-state.json` that no longer parses throws, so history never restarts silently. A `status-feed.json` that no longer parses is logged as `"warning": "status-feed-unreadable"` and treated as missing, so the run baselines again and the page keeps updating.
2. It judges every component from the probes and readings, with the incidents and notices from Contentful.
3. It validates the document, then writes `publisher-state.json` and `data/status.json`.
4. It works out which events the document owes subscribers and publishes them to the topic, ten to a `PublishBatch` call. Any failed entry or call throws and fails the run.
5. Only then does it write `status-feed.json`.

Because the feed state is written last, a failed send repeats the same events on the next run, while the history and the page, which were written before it, are not held back. Every event carries an `id` that is the same when a send is retried and different for a later, separate change of the same kind, so a subscriber can recognise a repeat. An update's id is its Contentful entry id, so editing an announced update's text, stage or time is not announced again, and two updates posted in the same minute are both announced. An incident's resolution, a window's start and a window's end carry their time in the id, so a reopened and resolved-again incident or a postponed window is announced afresh. A component change carries the time its previous state was announced. The first run, which finds no `status-feed.json`, sends nothing and only records the baseline, so incidents that are already open do not flood a channel.

The Lambda asks Contentful every five minutes, and the runs in between reuse the last answer, a failure included, so the space's API quota, which the website shares, is not spent every minute. A Contentful read that fails does not stop the run at first. The Lambda logs one JSON warning line with `"warning": "contentful-read-failed"` and uses the content from its last good read, which `status-feed.json` keeps, so the page keeps its notes while Contentful is down. Once that read is more than 15 minutes old, or when there is none to fall back on, the Lambda still writes everything and sends the events, then throws an error naming how long Contentful has been unreadable, so the errors alarm reaches someone. An answer whose only errors are `UNRESOLVABLE_LINK` is not a failed read: it means an incident links an update that is not published, and that update stays off the page.

## The topic

The module owns the SNS topic `status-events-<env>` and nothing that subscribes to it, so a chat integration or any other consumer attaches outside the module. The Slack feed is the [`status-slack`](../status-slack/README.md) module. The repository had no SNS topic before this one, so the topic is as small as it can be: standard, encrypted with the AWS managed key `alias/aws/sns`, with no access policy beyond the account's default.

Each message is one event as JSON, validated against `statusEventSchema` in `packages/monitoring`, and carries a `type` message attribute (`incident.opened`, `component.changed` and so on) that a subscription's filter policy can match. Delivery is at least once, so a subscriber should treat a repeated `id` as the same event.

The role may call `sns:Publish` on this topic only, and holds no `kms` permission. The AWS managed key's policy cannot be edited, and an IAM grant on a KMS key only works where the key policy allows it, so a grant here would either repeat what the key policy already allows or do nothing. A first publish that fails with `KMSAccessDeniedException` means that assumption did not hold; read the key's policy with `aws kms get-key-policy --key-id alias/aws/sns --policy-name default`.

## The Contentful secret

The publisher reads Contentful with its own secret, `openjii-status-contentful-<env>`, which the environment's `main.tf` creates through `modules/secrets-manager` from the same `contentful_space_id` and `contentful_access_token` variables that the web app's secret uses. It holds only those two keys. The preview credentials stay out of it, so the publisher can read published entries and nothing else. The role may call `secretsmanager:GetSecretValue` on this secret only. The Lambda keeps the credentials in memory between warm invocations and drops them when a read fails, so a rotated secret is picked up on the next run.

## Where the code lives

`lambda/index.js` is the handler only: the probes, the CloudWatch reads, the Contentful request, the S3 reads and writes and the SNS publish. Which signals to read, how readings become states, how minutes become uptime, the shape of the published file, the Contentful query and what counts as a new event live in `packages/monitoring` (the `status-*.ts` modules), with vitest coverage. The handler requires them from `./lib`, a copy of that package's compiled output.

## Build

```bash
pnpm turbo run build --filter=@repo/monitoring   # refresh dist/ first
cd infrastructure/modules/monitoring/status-publisher/lambda && npm run build
```
