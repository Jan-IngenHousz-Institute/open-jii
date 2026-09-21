# opennext-lambda-errors

**The Next.js server Lambda is erroring above its normal rate.** Every failure here is a page that
did not render for someone.

## Read the actual errors

```bash
aws logs tail /aws/lambda/open-jii-<env>-opennext-server --since 1h --filter-pattern "ERROR"
```

Correlate the onset with `git log --since="6 hours ago" --oneline origin/main`. A web deploy is the
most common trigger, and the fastest resolution is usually a rollback rather than a fix.

## Distinguish the three causes

**A missing environment variable or secret** fails every invocation identically and immediately
after a deploy or a rotation. The error names the variable.

**An upstream timeout** fails only pages that call it. The backend, Contentful and the PostHog proxy
are all reachable from server rendering, so a slow dependency surfaces here as Lambda duration
rising before errors start. Check `backend-5xx` for whether the API is the dependency that broke.

**Cold starts under burst** show as errors clustered at the start of a traffic ramp with healthy
steady state afterwards. The warmer exists to prevent this; if it is firing this way, check whether
the warmer is still running rather than chasing the page code.

## Cascade direction matters

`cloudfront-errors` usually fires alongside this one. CloudFront is downstream of the Lambda, so if
both are firing, this is the cause and that is the symptom. Working them in the wrong order wastes
the first twenty minutes.

## Closing

Note whether it was configuration, a dependency, or code. Configuration failures recur on the next
rotation; dependency failures recur whenever that dependency is slow.
