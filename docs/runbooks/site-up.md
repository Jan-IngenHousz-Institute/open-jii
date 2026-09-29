# site-up

**Route 53 cannot reach the public site.** Its health check requests `https://<base domain>/`
(`openjii.org` in prod, `dev.openjii.org` in dev) every 30 seconds and calls the site down after
three failures in a row, so this fires about a minute and a half after the site stops answering.
Nobody can use the platform while it holds.

## What a passing check proves

The probe goes through CloudFront to the OpenNext server Lambda, whose proxy answers `/` with a
redirect to `/en-US/`. Route 53 counts any status from 200 to 399 as healthy, so a pass means the
edge, the Lambda and the proxy answer. It never renders a page: a broken home page behind a working
redirect passes. That failure belongs to `pageview-collapse`.

## Confirm it from outside

```bash
curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' https://<base domain>/
```

Then read what each Route 53 checker saw. The health check id is the dimension on this entry's chart
in the daily report:

```bash
aws route53 get-health-check-status --health-check-id <health-check-id> \
  --query 'HealthCheckObservations[].[Region,StatusReport.Status]' --output text
```

A redirect from curl while the checkers report failures means they see something you do not; look
at the AWS Health Dashboard for Route 53 and CloudFront. Failures from only some regions point at
the edge rather than the site. A 5xx or a timeout means the site is down for you too.

## Likely causes, most common first

- **The server Lambda is failing.** Check `opennext-lambda-errors` and `web-server-throttles` in
  the same alert list. If either is firing, work that runbook: this one is its symptom.
- **A CloudFront or DNS change.** Behaviours and origins are in
  `infrastructure/modules/opennext/opennext-cloudfront`, the records in
  `infrastructure/modules/route53`. A change there propagates over minutes and can fail on some
  edges before others, which looks intermittent. `cloudfront-errors` covers the edge.
- **An AWS outage.** Route 53 or CloudFront trouble shows on the AWS Health Dashboard, and waiting
  is the only action.

## Closing

Note which layer failed. Confirm the check has passed for several minutes, since one pass after a
flap is not recovery.
