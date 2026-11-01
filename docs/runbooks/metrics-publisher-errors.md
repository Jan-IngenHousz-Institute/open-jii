# metrics-publisher-errors

**The metrics publisher threw, so this week's database counts did not reach CloudWatch.** It runs
on Mondays at 06:00 UTC and counts new researchers, all researchers, experiments created, and the
researchers who exported and who uploaded. Only the weekly report's New researchers, Researchers,
Experiments created, Researchers who exported and Researchers who uploaded tiles read them, and
those five show no data for the week until a run succeeds.

## Read what it said

```bash
aws logs tail /aws/lambda/<env>-metrics-publisher --since 2h
```

## What usually causes it

- **The database refused the connection or the query.** The publisher signs in to Aurora with IAM
  as `metrics_publisher`, which may read only the columns its counts use. A permission error on a
  column means a count was added without its grant migration.
- **The network:** the function runs in the VPC, so a timeout is usually its security group or the
  database being unavailable.

## Running it again

The weekly report reads each count's `Maximum`, so rerunning in the same week publishes the same
figures and cannot double them:

```bash
aws lambda invoke --function-name <env>-metrics-publisher /dev/stdout
```
