# databricks-spend-limit

**A Databricks pipeline, warehouse or job cost more than twice its usual day yesterday, at list
price, and at least $10 more.** The usual day is the median of the 14 days before. The alert names
the component; the Cost dashboard shows how far past its limit it is and, on the Databricks
charges chart under "Is anything running away?", when it started.

The VMs the clusters run on are billed by AWS as EC2 compute, so a Databricks spike usually comes
with an AWS one.

## Find what changed

The billing tables split a component's spend by SKU and day:

```sql
SELECT usage_date, sku_name, round(sum(usage_quantity), 1) AS dbus
FROM system.billing.usage
WHERE usage_date >= date_sub(current_date(), 15)
  AND usage_metadata.dlt_pipeline_id = '<pipeline id>'   -- or warehouse_id, or job_id
GROUP BY usage_date, sku_name
ORDER BY usage_date
```

Run it on the Investigations warehouse. `apps/data/src/lib/openjii/openjii/heartbeat/costs.py` says
which id each component bills under; `jobs` is every job run, and `other` is the rest of the
workspace.

## What it usually is

- **A pipeline running longer or larger:** a backlog after a stall, a full refresh, or a change to
  its cluster size or schedule.
- **A warehouse staying up:** queries arriving often enough that it never auto-stops.
- **A job looping or retrying:** the job run history shows it.

## Closing

Say in the alert's Slack thread what it was and whether anything changed because of it.
