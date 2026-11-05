# status-publisher

Checks the platform every minute and writes the public status page's data file. An EventBridge schedule invokes the Lambda, which requests the web app and the API's health endpoint, reads the signals each component is judged on from CloudWatch, and writes two objects: `data/status.json` in the public site bucket, which the page fetches, and `publisher-state.json` in a private state bucket, which carries each component's 90 days of history between runs.

The function runs one at a time and does not retry a failed minute. The next run records the lost minute as unknown time.

Each run reads about twenty metrics with GetMetricData, which CloudWatch bills per metric read, so the publisher costs roughly ten dollars a month per environment at list price. Its S3 requests and Lambda time add less than a dollar.

| Input                 | What it is                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `environment`         | Deployment environment, used in resource names and as the metrics' scope                                 |
| `site_bucket_id`      | Public bucket the page is served from; the publisher writes `data/status.json` there                     |
| `site_bucket_arn`     | ARN of the public site bucket                                                                            |
| `state_bucket_id`     | Private, versioned bucket holding `publisher-state.json`                                                 |
| `state_bucket_arn`    | ARN of the state bucket                                                                                  |
| `web_url`             | Public https URL of a web app page that reads nothing from the backend, which the website check requests |
| `api_health_url`      | Public https URL of the backend's health endpoint                                                        |
| `load_balancer_arn`   | Backend ALB, from which the CloudWatch `LoadBalancer` dimension is derived                               |
| `web_distribution_id` | CloudFront distribution serving the web app                                                              |
| `kinesis_stream_name` | Ingest stream whose metrics the data intake check reads                                                  |
| `log_retention_days`  | CloudWatch log retention, 30 days by default                                                             |

The `function_name` output feeds the dashboard module, whose `Status Publisher Errors` and `Status Publisher Stopped` rules watch the function. See [`docs/runbooks/status-publisher-errors.md`](../../../../docs/runbooks/status-publisher-errors.md) and [`docs/runbooks/status-publisher-stopped.md`](../../../../docs/runbooks/status-publisher-stopped.md).

## Where the code lives

`lambda/index.js` is the handler only: the probes, the CloudWatch reads and the S3 reads and writes. Which signals to read, how readings become states, how minutes become uptime and the shape of the published file live in `packages/monitoring` (the `status-*.ts` modules), with vitest coverage. The handler requires them from `./lib`, a copy of that package's compiled output.

## Build

```bash
pnpm turbo run build --filter=@repo/monitoring   # refresh dist/ first
cd infrastructure/modules/monitoring/status-publisher/lambda && npm run build
```
