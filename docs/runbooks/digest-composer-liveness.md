# digest-composer-liveness

**The digest composer has not run for over a day.** Nothing else watches the platform on a
schedule, so while this is true every signal in the catalog is unobserved. The digests are the only
thing that would have told you, and they are what stopped.

This alarms on absence rather than on a value. A Lambda that is never invoked publishes no metric at
all, so there is no number to threshold, and the rule treats missing data as firing.

## Decide first whether it failed or was never triggered

```bash
aws logs tail /aws/lambda/<env>-digest-composer --since 36h
```

- **Log lines with an error.** The function ran and threw. The message names which digest and, for a
  CloudWatch failure, which region. Go to the next section.
- **No log lines at all.** The function was never invoked, so the problem is upstream of the code:
  either the schedule or the permission to invoke.

```bash
aws events list-rules --name-prefix <env>-digest-composer
aws events list-targets-by-rule --rule <env>-digest-composer-observability
```

A rule in state `DISABLED` is the usual answer, and someone disabled it. A rule that is enabled with
no targets means a partial apply; re-run the deploy.

## If it ran and threw

The handler throws on an unknown digest type and on a Slack delivery failure. Everything else is
caught and reported inside the digest itself, which is why a thrown error usually means delivery
rather than collection.

A `Slack webhook returned 404` means the webhook was revoked or the app was removed from the
channel. A timeout after 10s means Slack was unreachable; that one recovers on its own and only
matters if it repeats.

## What you lost while it was down

Nothing is queued. A digest is composed from the window it runs in, so a missed morning is a morning
nobody looked, not a backlog to replay. Read the window by hand before closing:

```bash
aws lambda invoke --function-name <env>-digest-composer \
  --payload '{"digest":"observability"}' --cli-binary-format raw-in-base64-out /dev/stdout
```

With the webhook variables set this posts to the channel; the digest it produces covers the last
24 hours, not the days that were missed.

## Closing

Note what stopped it and for how long. A schedule someone disabled during unrelated work is the
common cause, and the second occurrence should be recognised in a minute rather than an hour.
