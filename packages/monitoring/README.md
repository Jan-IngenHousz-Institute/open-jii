# @repo/monitoring

The platform heartbeat's tested logic: the metrics forwarder's parsing, and the checks that keep the metric catalogue, the heartbeat exporter, the Grafana rules and the report dashboards in step.

| Module                        | Responsibility                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `forwarder.ts`                | Parse the NDJSON heartbeat file into CloudWatch datapoints and batch them                 |
| `catalog.ts`                  | Parse `docs/monitoring/metrics-catalog.yaml`                                              |
| `catalog-consistency.test.ts` | Fail when the catalogue, the exporter's metric names, the rules or the dashboards diverge |

## How it reaches the Lambda

The metrics forwarder lives in `infrastructure/modules/monitoring/metrics-forwarder/lambda` as a self-contained npm project, deliberately outside the pnpm workspace: a Lambda zip needs real `node_modules`, and pnpm's symlinked tree does not survive zipping. Its build step compiles this package and copies `dist/` in as `lib/`.

Import the specific module you need (`lib/forwarder.js`), never a barrel. There is no barrel on purpose: pulling `catalog.ts` into the forwarder would drag `js-yaml` into a bundle that does not ship it, which is a runtime crash rather than a build error.

## Tests

`pnpm turbo run test --filter=@repo/monitoring`. These run in CI like any other package, which is the whole reason the logic lives here rather than beside the handler.
