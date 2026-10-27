# cost-publisher

Publishes what AWS charges into CloudWatch four times a day, at 00:30, 06:30, 12:30 and 18:30 UTC, for the Cost dashboard and the weekly report's Cost section. It reads Cost Explorer's unblended cost and writes to `OpenJII/Cost`. Every point carries an `Environment` dimension.

| Metric                       | Dimensions            | Window, stamped when it closed                                        |
| ---------------------------- | --------------------- | --------------------------------------------------------------------- |
| `DailyCostUsd`               | `Category`, `Service` | Yesterday and the day before, usage only                              |
| `WeeklyCostUsd`              | `Category`, `Service` | The latest complete ISO week, usage only                              |
| `MonthToDateCostUsd`         |                       | The month of yesterday, to yesterday, tax and fees included           |
| `PreviousMonthToDateCostUsd` |                       | The month before, to the same day, its tax and fees prorated by usage |
| `PreviousMonthCostUsd`       |                       | The whole month before, tax and fees included                         |
| `PreviousMonthTaxAndFeesUsd` |                       | What the whole month before billed beyond usage                       |
| `MonthForecastCostUsd`       |                       | Cost Explorer's forecast for the month, actuals included              |

A service's label and category come from `docs/monitoring/cost-services.json`, which the dashboards read too. A service the file does not list is counted as `Other AWS services`.

## Why each point is stamped at its window's close

CloudWatch holds back a point stamped a day or more in the past for at least 48 hours before GetMetricData returns it. So yesterday is stamped at today's 00:00, and the week at the Monday it closed. A window that closes at midnight lands in exactly one daily or weekly bucket, however a dashboard aligns its periods.

Cost Explorer keeps revising recent days. Every run republishes yesterday, the day before, the latest week and the month figures, and the dashboards read `Maximum`, so the fuller figure wins and a retried run cannot double-count. Four runs refine a window on the day it closed, while CloudWatch still returns each one within two hours.

## Tax and fees

AWS dates a whole month's tax and fees on the 1st and adds to them as the month's usage grows. On dev they ran at 21% on top of usage every month from August to October 2026. So no week carries its own share, and the weekly figures are usage only. The month before is compared at the same day with its tax and fees in proportion to its usage by then, since the month so far carries only what has accrued.

## Where the code lives

`lambda/index.js` is the handler only: the Cost Explorer reads and the CloudWatch write. Which windows to ask for and how the answers become datapoints live in `packages/monitoring/src/cost.ts`, with vitest coverage.

Cost Explorer charges a cent per request. A run makes three, so the publisher costs about $3.60 a month per environment.

## Build

```bash
pnpm turbo run build --filter=@repo/monitoring   # refresh dist/ first
cd infrastructure/modules/grafana/cost-publisher/lambda && npm run build
```
