# @repo/monitoring

Decision logic for the platform heartbeat: everything the monitoring Lambdas do that is worth testing.

| Module         | Responsibility                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `catalog.ts`   | Parse `docs/monitoring/metrics-catalog.yaml`, resolve `${PLACEHOLDER}`s, build CloudWatch queries |
| `baseline.ts`  | Aggregate windows, derive baselines, decide whether a reading is an anomaly                       |
| `render.ts`    | Format the Slack digests (green line, anomaly blocks, level lists with deltas)                    |
| `forwarder.ts` | Parse the NDJSON heartbeat file into CloudWatch datapoints and batch them                         |

## How it reaches the Lambdas

The Lambdas live in `infrastructure/modules/monitoring/*/lambda` as self-contained npm projects, deliberately outside the pnpm workspace: a Lambda zip needs real `node_modules`, and pnpm's symlinked tree does not survive zipping. Their build step compiles this package and copies `dist/` in as `lib/`.

Import the specific module you need (`lib/forwarder.js`), never a barrel. There is no barrel on purpose: pulling `catalog.ts` into the forwarder would drag `js-yaml` into a bundle that does not ship it, which is a runtime crash rather than a build error.

## Tests

`pnpm turbo run test --filter=@repo/monitoring`. These run in CI like any other package, which is the whole reason the logic lives here rather than beside the handlers.
