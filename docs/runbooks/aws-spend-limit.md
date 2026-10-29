# aws-spend-limit

**An AWS service cost more than twice its usual day yesterday, and at least $10 more.** The usual
day is the median of the 14 days before. The alert names the service; the Cost dashboard's
"Yesterday, against each limit" shows how far past it is, and the service's category chart under
"Is anything running away?" shows when it started.

A step that lasts keeps the alert firing until the new level has become the median, about a week
later, and it posts when it fires and when it clears.

## Find what changed

Cost Explorer splits a service by usage type, which usually names the cause: instance hours, NAT
gateway bytes, log ingestion, storage.

```bash
aws ce get-cost-and-usage --profile openjii-<env> --region us-east-1 \
  --time-period Start=<14 days ago>,End=<today> --granularity DAILY --metrics UnblendedCost \
  --filter '{"Dimensions": {"Key": "SERVICE", "Values": ["<the service as Cost Explorer names it>"]}}' \
  --group-by Type=DIMENSION,Key=USAGE_TYPE
```

The Cost Explorer names are the keys of `docs/monitoring/cost-services.json`.

## What it usually is

- **EC2 compute** is Databricks' cluster VMs. A pipeline or job that scaled up, or a cluster left
  running, shows on the Databricks spend alert or the Databricks chart at the same time.
- **EC2 other** is disks, NAT and IPs: a jump in NAT bytes is usually a pipeline reading or writing
  across the internet, such as a bulk export.
- **CloudWatch** is usually log ingestion: a service logging in a loop, or debug logging left on.
- **A deliberate change**, such as a bigger instance or a new environment feature. Record it, and the
  alert clears on its own once the new level is the usual.

## Closing

Say in the alert's Slack thread what it was and whether anything changed because of it.
