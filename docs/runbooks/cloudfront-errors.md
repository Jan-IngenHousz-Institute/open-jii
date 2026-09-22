# cloudfront-errors

**The web distribution is returning 5xx above threshold.** CloudFront sits in front of the OpenNext
server Lambda, so it reports both its own failures and the origin's.

Note that CloudFront metrics live in `us-east-1` regardless of where the rest of the platform runs.
A query against the regional endpoint returns nothing and looks exactly like an outage.

## Origin or edge

```bash
# On Linux, GNU date wants -d '3 hours ago' where BSD date wants -v-3H
aws cloudwatch get-metric-statistics --region us-east-1 \
  --namespace AWS/CloudFront --metric-name 5xxErrorRate \
  --dimensions Name=DistributionId,Value=<id> Name=Region,Value=Global \
  --start-time "$(date -u -v-3H +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 300 --statistics Average
```

Then check `opennext-lambda-errors` in the same digest. If it is firing too, the origin is the cause
and that runbook is the one to work. If the Lambda is clean while CloudFront is not, the failure is
at the edge: a distribution config change, an origin that CloudFront cannot reach, or a cache
behaviour pointing somewhere wrong.

## Distribution changes are the usual edge cause

Behaviours, origin request policies and cache policies are all in
`infrastructure/modules/opennext/opennext-cloudfront`. A change there takes minutes to propagate and
can produce errors on some edges before others, which shows up as a partial rather than total
failure and is easy to misread as intermittent.

## What this metric will not tell you

A page that renders blank with a 200 does not appear here at all. CloudFront is happy, the Lambda is
happy, and users see nothing. That failure belongs to `pageview-collapse`, which watches from the
browser rather than from the edge. If users report an outage the infrastructure disagrees with,
start there instead.

## Closing

Confirm the rate is back under threshold across a full period, not just in the most recent sample:
propagation makes recovery look jagged.
