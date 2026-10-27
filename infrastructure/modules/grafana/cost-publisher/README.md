# cost-publisher

Publishes what AWS charges into CloudWatch once a day at 06:00 UTC, for the Cost dashboard and the weekly report's Cost section. It reads Cost Explorer's unblended cost and writes to `OpenJII/Cost`. Every point carries an `Environment` dimension.

| Metric                       | Dimensions            | Window, stamped when it closed                             |
| ---------------------------- | --------------------- | ---------------------------------------------------------- |
| `DailyCostUsd`               | `Category`, `Service` | Yesterday and the day before, usage only                   |
| `WeeklyCostUsd`              | `Category`, `Service` | The latest complete ISO week, with tax and fees as one row |
| `MonthToDateCostUsd`         |                       | The month of yesterday, to yesterday                       |
| `PreviousMonthToDateCostUsd` |                       | The month before, to the same day                          |
| `PreviousMonthCostUsd`       |                       | The whole month before                                     |
| `MonthForecastCostUsd`       |                       | Cost Explorer's forecast for the month, actuals included   |

A service's label and category come from `docs/monitoring/cost-services.json`, which the dashboards read too. A service the file does not list is counted as `Other AWS services`.

## Why each point is stamped at its window's close

CloudWatch holds back a point stamped a day or more in the past for at least 48 hours before GetMetricData returns it. So yesterday is stamped at today's 00:00, and the week at the Monday it closed. A window that closes at midnight lands in exactly one daily or weekly bucket, however a dashboard aligns its periods.

Cost Explorer keeps revising recent days. The day before and the latest week are republished on every run, and the dashboards read `Maximum`, so the fuller figure wins and a retried run cannot double-count.

## Where the code lives

`lambda/index.js` is the handler only: the Cost Explorer reads and the CloudWatch write. Which windows to ask for and how the answers become datapoints live in `packages/monitoring/src/cost.ts`, with vitest coverage.

Cost Explorer charges a cent per request, and a run makes three.

## Build

```bash
pnpm turbo run build --filter=@repo/monitoring   # refresh dist/ first
cd infrastructure/modules/grafana/cost-publisher/lambda && npm run build
```
