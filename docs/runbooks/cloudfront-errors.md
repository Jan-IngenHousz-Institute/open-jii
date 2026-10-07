# cloudfront-errors

**The web distribution is returning 5xx above threshold.** CloudFront sits in front of the OpenNext
server Lambda, so it reports both its own failures and the origin's.

The rule fires only when more than 5% of requests, and at least 50 of them, fail within five
minutes. It does not mean the site is unreachable; `site-up` watches that.

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

Then check `opennext-lambda-errors` in the same alert list. If it is firing too, the origin is the cause
and that runbook is the one to work. If the Lambda is clean while CloudFront is not, the failure is
at the edge: a distribution config change, an origin that CloudFront cannot reach, or a cache
behaviour pointing somewhere wrong.

## Which requests failed

The distribution writes access logs to
`s3://open-jii-eu-central-1-access-logs/cloudfront-logs/opennext/<distribution-id>.YYYY-MM-DD-HH.*.gz`.
They usually land within minutes, but AWS only promises an hour and some entries take up to 24, so
an empty result for the last hour proves nothing; read the metrics until the logs catch up. Field 9
is the status, field 8 the path, so `gzcat *.gz | awk -F'\t' '$9 ~ /^5/ {print $2, $8, $9}'` names
them.

502s on `/_next/image` are the image Lambda (`open-jii-<env>-opennext-image-optimization`), not the
server. If its log says `Exceeded maximum allowed payload size`, the response went over Lambda's
6 MB limit. In October 2026 the Lambda was returning Contentful originals unresized, so any CMS
photo over about 6 MB failed every time it was requested.

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
