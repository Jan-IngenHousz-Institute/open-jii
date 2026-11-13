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

Access logs record request metadata without cookie values. The cookie field is `-`;
the status and path fields above stay in their usual positions. CloudFront log
objects under `cloudfront-logs/` expire 30 days after creation. Previous versions
expire 30 days after becoming noncurrent. Dev, production and DR use the same
cookie-free distribution modules and retention rule. Firewall logs continue to redact `cookie` and `authorization`.

## Approve retention and clear historical logs

Before applying the retention rule, the platform lead must confirm that no investigation
needs logs older than 30 days. Existing objects already older than 30 days become
eligible for removal at the first lifecycle processing after apply. Obtain this
confirmation before approving the apply, and review a separate infrastructure
plan for each environment.

After the platform lead explicitly approves clearing the stored CloudFront logs, an operator
deletes objects under `cloudfront-logs/` in each of dev, production and DR's access-log buckets,
including any previous versions. Record the confirmation, environment, prefix
and completion in the ticket. Keep other prefixes, including ALB logs. This is a
manual operator step; the pull request does not delete stored logs or run a
cleanup command.

The repository's Access Log Policy check runs without credentials and rejects
cookie logging, missing CloudFront retention or missing firewall redactions.
It runs inside the required Build, Lint, & Test check, including on infrastructure-only
PRs. Adding standard logging v2 or real-time logging requires extending the
policy to check their cookie fields before those resources can be introduced.
Run it locally with `node --test infrastructure/tests/access-log-policy.test.mjs`.

## Distribution changes are the usual edge cause

Behaviours, origin request policies and cache policies are all in
`infrastructure/modules/opennext/opennext-cloudfront`. A change there takes minutes to propagate and
can produce errors on some edges before others, which shows up as a partial rather than total
failure and is easy to misread as intermittent.

## What this metric will not tell you

A page that renders blank with a 200 does not appear here at all: CloudFront and the Lambda are both
happy while users see nothing. An error the page server throws while rendering reaches the error
inbox for every visitor, and a new one posts to Slack. An error in the browser reaches it only from a
visitor who accepted cookies, once the analytics have loaded, so a blank page that throws nothing on
the server can pass unnoticed. If users report an outage the infrastructure disagrees with, load the
site in a private window and read the browser console. If the onset matches a web deploy, roll back
first.

## Closing

Confirm the rate is back under threshold across a full period, not just in the most recent sample:
propagation makes recovery look jagged.
