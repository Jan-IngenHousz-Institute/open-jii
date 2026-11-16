# monthly-cost

**What a full calendar month of the platform cost, per pipeline and warehouse, and what each
pipeline update did.** Use it for a monthly figure, a before and after of a change, or a baseline.
The Cost dashboard shows days, weeks and the month so far; this is the month on record.

Every figure is list price. The rate actually paid may be lower, so treat Databricks' numbers as an
upper bound.

## Databricks, per pipeline and warehouse

Run this on the environment's Investigations warehouse, with the first day of the month and the
workspace id (the heartbeat job's `WORKSPACE_ID` parameter). It prices usage the way the heartbeat
does (`apps/data/src/lib/openjii/openjii/heartbeat/costs.py`), and a test holds the two together.

<!-- monthly-cost-databricks -->

```sql
SELECT u.billing_origin_product AS product,
       coalesce(u.usage_metadata.dlt_pipeline_id, u.usage_metadata.warehouse_id) AS billed_under,
       round(sum(u.usage_quantity * p.pricing.effective_list.default), 2) AS usd
FROM system.billing.usage u
JOIN system.billing.list_prices p
  ON p.sku_name = u.sku_name AND p.cloud = u.cloud AND p.usage_unit = u.usage_unit
 AND u.usage_end_time >= p.price_start_time
 AND (p.price_end_time IS NULL OR u.usage_end_time < p.price_end_time)
WHERE u.usage_date >= DATE'<first day>' AND u.usage_date < add_months(DATE'<first day>', 1)
  AND u.workspace_id = '<workspace id>'
GROUP BY ALL
ORDER BY usd DESC
```

`billed_under` is a pipeline id for `DLT` rows and a warehouse id for `SQL` rows.
`databricks pipelines list-pipelines -p <profile>` and `databricks warehouses list -p <profile>`
name them: Centrum, the macro pipeline and the metrics pipeline among the pipelines, the backend's
and the Investigations warehouse among the warehouses. Rows with no id are job runs (`JOBS`) and
the workspace's other products.

The VMs the pipelines run on are billed by AWS as EC2, below.

## AWS, per service

The Cost dashboard's "the whole month before" figures and its service table give the month just
ended. For any other month, ask Cost Explorer the way the cost publisher does
(`packages/monitoring/src/cost.ts`), usage alone, by service:

```bash
aws ce get-cost-and-usage --profile openjii-<env> \
  --time-period Start=<first day>,End=<first day of the next month> \
  --granularity MONTHLY --metrics UnblendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --filter '{"Dimensions":{"Key":"RECORD_TYPE","Values":["Usage"]}}'
```

Kinesis is "Amazon Kinesis", storage "Amazon Simple Storage Service", and the clusters' VMs are part
of "Amazon Elastic Compute Cloud - Compute". Tax and fees come on the 1st as their own record type;
drop the filter to see them.

## What each pipeline update did

`event_log()` refuses on both environments, so read the pipeline events API, which gives the same
events to anyone with access to the pipeline. It filters only by level and time, not by event type,
and a continuous pipeline such as Centrum writes autoscale events all day, so start from the
updates:

```bash
databricks pipelines list-updates <pipeline id> -p <profile> --max-results 5 --output json \
  | jq -r '.updates[] | [.update_id, (.creation_time / 1000 | todate), .state, .cause] | @tsv'
```

Then read one update's events forward from its start, where each flow plans its refresh:

```bash
databricks api get "/api/2.0/pipelines/<pipeline id>/events?max_results=250&order_by=timestamp%20asc&filter=timestamp%20%3E%3D%20%27<update start>%27" -p <profile> \
  | jq -r '.events[]
      | select(.event_type == "planning_information")
      | [.timestamp, .origin.update_id, .origin.flow_name,
         (.details.planning_information.technique_information[] | select(.is_chosen) | .maintenance_type)]
      | @tsv'
```

Each line is one flow in one update and the refresh technique it chose, such as
`MAINTENANCE_TYPE_NO_OP` or `MAINTENANCE_TYPE_COMPLETE_RECOMPUTE`. A page holds at most 250 events;
pass the response's `next_page_token` as `page_token` for the next.
