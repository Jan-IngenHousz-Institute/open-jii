# @repo/monitoring

The platform heartbeat's tested logic: the metrics forwarder's parsing, the cost publisher's windows, and the checks that keep the metric catalogue, the heartbeat exporter, the Grafana rules and the report dashboards in step.

| Module                        | Responsibility                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `forwarder.ts`                | Parse the NDJSON heartbeat file into CloudWatch datapoints and batch them                    |
| `cost.ts`                     | Turn Cost Explorer's answers into each day's, week's and month's spend                       |
| `status-document.ts`          | The schema of the file the public status page reads                                          |
| `status-components.ts`        | The public status page's components, their signals and the CloudWatch queries that read them |
| `status-readings.ts`          | Turn a region's GetMetricData results into one reading per signal                            |
| `status-judge.ts`             | Judge each component from a run's probes and readings and build the status document          |
| `status-history.ts`           | Keep each component's 90 days of minute tallies and compute uptime from them                 |
| `status-content.ts`           | Query Contentful for incidents and notices and map them onto the status document             |
| `status-events.ts`            | Work out what changed since subscribers were last told, for a channel such as Slack          |
| `status-feed.ts`              | The state the publisher keeps beside its history: what was announced and the last content    |
| `status-probes.ts`            | What a healthy answer from the website and the API looks like                                |
| `status-slack.ts`             | Turn one status event into the Slack message that the status channel receives                |
| `catalog.ts`                  | Parse `docs/monitoring/metrics-catalog.yaml`                                                 |
| `catalog-consistency.test.ts` | Fail when the catalogue, the exporter's metric names, the rules or the dashboards diverge    |

## How it reaches the Lambda

The metrics forwarder lives in `infrastructure/modules/monitoring/metrics-forwarder/lambda`, the cost publisher in `infrastructure/modules/grafana/cost-publisher/lambda`, the status publisher in `infrastructure/modules/monitoring/status-publisher/lambda`, and the status Slack function in `infrastructure/modules/monitoring/status-slack/lambda`, each as a self-contained npm project, deliberately outside the pnpm workspace: a Lambda zip needs real `node_modules`, and pnpm's symlinked tree does not survive zipping. Each build step copies this package's compiled `dist/` in as `lib/`, so after changing any module here run `pnpm turbo run build --filter=@repo/monitoring` and rebuild every bundle listed in `BUNDLE_DIRS` in `.github/workflows/pr.yml` with `npm run build` in its lambda directory.

Import the specific module you need (`lib/forwarder.js`, `lib/cost.js`, `lib/status-judge.js`), never a barrel. There is no barrel on purpose: pulling `catalog.ts` into the forwarder would drag `js-yaml` into a bundle that does not ship it, which is a runtime crash rather than a build error.

## Tests

`pnpm turbo run test --filter=@repo/monitoring`. These run in CI like any other package, which is the whole reason the logic lives here rather than beside the handler.
