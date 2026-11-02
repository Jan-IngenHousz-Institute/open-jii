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

Run it on the Investigations warehouse. `databricks_cost_components` in
`infrastructure/env/<env>/main.tf` lists the id each component bills under, which the heartbeat job
receives as `COST_COMPONENTS`.

`jobs` and `other` have no single id: `jobs` is every job run, and `other` is the rest of the
workspace. Split the workspace's spend at list price by product and job instead, with the heartbeat
job's `WORKSPACE_ID`. Products bill in different units, so this prices each row the way the export
does rather than adding up quantities:

```sql
SELECT u.usage_date, u.billing_origin_product, u.usage_metadata.job_id,
       round(sum(u.usage_quantity * p.pricing.effective_list.default), 2) AS usd
FROM system.billing.usage u
JOIN system.billing.list_prices p
  ON p.sku_name = u.sku_name AND p.cloud = u.cloud AND p.usage_unit = u.usage_unit
 AND u.usage_end_time >= p.price_start_time
 AND (p.price_end_time IS NULL OR u.usage_end_time < p.price_end_time)
WHERE u.usage_date >= date_sub(current_date(), 15)
  AND u.workspace_id = '<workspace id>'
GROUP BY u.usage_date, u.billing_origin_product, u.usage_metadata.job_id
ORDER BY u.usage_date, usd DESC
```

`JOBS` rows are the `jobs` component, one per job. Every other row is `other`, except the usage of
the named pipelines and warehouses.

## What it usually is

- **A pipeline running longer or larger:** a backlog after a stall, a full refresh, or a change to
  its cluster size or schedule.
- **A warehouse staying up:** queries arriving often enough that it never auto-stops.
- **A job looping or retrying:** the job run history shows it.

## Closing

Say in the alert's Slack thread what it was and whether anything changed because of it.
