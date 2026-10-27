# @repo/monitoring

The platform heartbeat's tested logic: the metrics forwarder's parsing, the cost publisher's windows, and the checks that keep the metric catalogue, the heartbeat exporter, the Grafana rules and the report dashboards in step.

| Module                        | Responsibility                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `forwarder.ts`                | Parse the NDJSON heartbeat file into CloudWatch datapoints and batch them                 |
| `cost.ts`                     | Turn Cost Explorer's answers into each day's, week's and month's spend                    |
| `catalog.ts`                  | Parse `docs/monitoring/metrics-catalog.yaml`                                              |
| `catalog-consistency.test.ts` | Fail when the catalogue, the exporter's metric names, the rules or the dashboards diverge |

## How it reaches the Lambda

The metrics forwarder lives in `infrastructure/modules/monitoring/metrics-forwarder/lambda`, and the cost publisher in `infrastructure/modules/grafana/cost-publisher/lambda`, each as a self-contained npm project, deliberately outside the pnpm workspace: a Lambda zip needs real `node_modules`, and pnpm's symlinked tree does not survive zipping. Each build step copies this package's compiled `dist/` in as `lib/`, so rebuild both bundles after changing any module here.

Import the specific module you need (`lib/forwarder.js`, `lib/cost.js`), never a barrel. There is no barrel on purpose: pulling `catalog.ts` into the forwarder would drag `js-yaml` into a bundle that does not ship it, which is a runtime crash rather than a build error.

## Tests

`pnpm turbo run test --filter=@repo/monitoring`. These run in CI like any other package, which is the whole reason the logic lives here rather than beside the handler.
