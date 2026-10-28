# cost-publisher-errors

**A run of the cost publisher threw, so it published nothing.** The Cost dashboard and the weekly
report's Cost section keep showing the last figures that landed, which look current but are not.
Nothing is lost: Cost Explorer still holds every figure, and the next run that succeeds publishes
yesterday, the day before, the latest week and the month again.

The publisher runs at 00:30, 06:30, 12:30 and 18:30 UTC, and Lambda retries a failed run
twice, so one failure can count up to three errors.

## Read what it said

```bash
aws logs tail /aws/lambda/<env>-cost-publisher --since 7h
```

A successful run ends with `{"published": N, "forecastError": null}`. A run that threw ends with the
error instead. A failed forecast does not throw: the run publishes everything else and names the
error in `forecastError`, so only the projected tile goes quiet.

## What usually causes it

- **Cost Explorer refused the request.** `AccessDeniedException` means the role lost
  `ce:GetCostAndUsage`, or the organisation's management account stopped sharing Cost Explorer with
  member accounts. `LimitExceededException` is throttling and passes on the next run.
- **CloudWatch refused the datapoints.** An `AccessDenied` on `PutMetricData` means the namespace in
  the role's condition and in `packages/monitoring/src/cost.ts` no longer match.
- **A deploy shipped a stale bundle.** A `Cannot find module` error means `function.zip` was built
  before `@repo/monitoring` or without `cost-services.json`. Rebuild it as the module's README says.

## Running it again

After fixing the cause, run it by hand rather than waiting for the next slot:

```bash
aws lambda invoke --function-name <env>-cost-publisher /dev/stdout
```

Republishing is safe: the dashboards read `Maximum`, so a window published twice keeps its fuller
figure. A day closed more than 24 hours ago reaches GetMetricData only after two days, so a gap
longer than a day fills in late.
