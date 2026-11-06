# ingest-healthcheck-errors

**The ingest health check publisher failed more than twice in five minutes.** It runs every minute
and is not retried, so each failed run is a minute without a message. The health check then stops
saying whether the ingest path works, and `ingest-healthcheck-age` can fire on the publisher alone,
60 to 100 minutes after it broke. Nothing else is affected: the function publishes one synthetic
message and writes nothing else.

## Read what it said

```bash
aws logs tail /aws/lambda/<env>-ingest-healthcheck --since 15m
```

A run that succeeds logs only Lambda's own start, end and report lines. A run that threw ends with
its error.

## What usually causes it

- **IoT refused the publish.** An authorization error naming `iot:Publish` means the role lost its
  one permission, on exactly the health check's topic, or an account-level policy denies it.
- **A setting is missing.** `ENVIRONMENT, IOT_DATA_ENDPOINT and TOPIC are required` means the
  function's environment variables were cleared. They come from the module's `main.tf`.
- **The endpoint is wrong.** A connection error naming the host means `IOT_DATA_ENDPOINT` no longer
  matches the account's `iot:Data-ATS` endpoint:

  ```bash
  aws iot describe-endpoint --endpoint-type iot:Data-ATS
  ```

- **A deploy shipped a broken bundle.** A `Cannot find module` error means `function.zip` was built
  without its dependencies. Rebuild it with `npm run build` in the module's `lambda` directory.
- **The function timed out.** Its limit is ten seconds, which a healthy publish uses a fraction of;
  a timeout means IoT's data plane was slow or unreachable.

## Running it again

After fixing the cause, publish one by hand rather than waiting for the next minute:

```bash
aws lambda invoke --function-name <env>-ingest-healthcheck /dev/stdout
```

A response with no `FunctionError` is a message sent. Each one stands alone, so running it extra
times is safe.

## Closing

Do not close until a message has arrived: the health check's age on the daily report drops to a few
minutes at the next export. If `ingest-healthcheck-age` fired meanwhile, it clears at that export
too, and its own runbook says how to tell the publisher's failure from the path's.
