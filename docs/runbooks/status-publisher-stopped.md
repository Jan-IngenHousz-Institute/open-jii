# status-publisher-stopped

**The status publisher is not running every minute, so the public status page's data file has
stopped updating.** The schedule should invoke it five times in five minutes. This fires on fewer
than three, and when CloudWatch has no invocation datapoints at all, which is what a function
that is never called looks like. `status-publisher-errors` cannot see this: a function that does not
run reports no errors.

The file stays as the last run left it, and the page shows when it was last checked. The minutes
nobody checked are recorded as unknown time the next time a run succeeds.

## Check the schedule

```bash
aws events describe-rule --name <env>-status-publisher-schedule
aws events list-targets-by-rule --rule <env>-status-publisher-schedule
```

The rule should be `ENABLED` with `rate(1 minute)`, and carry one target, the
`<env>-status-publisher` function.

## What usually causes it

- **The rule is disabled.** `State` is `DISABLED` in the first command. Re-enable it with
  `aws events enable-rule --name <env>-status-publisher-schedule`, and then find out who disabled it,
  since the next apply would have put it back.
- **The permission to invoke was removed.** The rule has a target but nothing arrives. Check that the
  function's resource policy still allows `events.amazonaws.com` to invoke it from this rule:

  ```bash
  aws lambda get-policy --function-name <env>-status-publisher
  ```

  A missing `AllowExecutionFromEventBridge` statement means the permission was deleted or the
  function was replaced without it. Applying the `status-publisher` module restores it.

- **Throttling.** The function is limited to one run at a time, and Lambda does not count a
  throttled request as an invocation. A reserved concurrency of 0 refuses every run:

  ```bash
  aws lambda get-function-concurrency --function-name <env>-status-publisher
  ```

  It should answer 1. A long hang, such as repeated `Task timed out` in the log, can also hold the
  slot past the next minute, and `status-publisher-errors` fires beside this one.

- **A deploy.** The apply replaced the function or changed its settings. Compare the rule's target
  ARN with the function's own (`aws lambda get-function --function-name <env>-status-publisher`)
  and the concurrency above with `infrastructure/modules/monitoring/status-publisher/main.tf`, and
  apply the module again where they differ.

## Running it once

To check that the function itself works, invoke it by hand:

```bash
aws lambda invoke --function-name <env>-status-publisher /dev/stdout
```

A successful run ends with a line naming each component's state and both probes. If that works and
the rule is enabled with the target and permission in place, the schedule resumes on the next minute
and the alert clears about five minutes after.
