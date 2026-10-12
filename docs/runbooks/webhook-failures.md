# webhook-failures

**HMAC-authenticated traffic between Databricks and the backend is failing.** The pipeline calls the
backend to resolve user metadata, execute macro batches and look up the device registry; the backend
is called back for project transfers. A break here does not stop ingestion, it silently degrades
enrichment, which is why it is worth an alarm rather than a dashboard.

The backend's HMAC guard logs each rejected call once with a `reason`, and a metric filter on its log
group counts them as `PipelineCallsRejected` per `Reason`. The alert counts every reason except
`missing-key-id`: anyone can send a call with no key id, so that one says nothing about the pipeline.
The pipeline records a rejected macro batch on each of its rows and carries on, which is why nothing
else shows the break.

## Establish the direction

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 1h --filter-pattern '{ $.errorCode = "HMAC_AUTHENTICATION_FAILED" }'
```

Rejections logged by the backend mean Databricks called and was refused. Silence in the backend
while the pipeline reports failures means the call never arrived, which is a network or URL problem
rather than an authentication one.

## The reason is diagnostic

Each reason points somewhere different.

**`unknown-key`, and `missing-key-id` from the pipeline itself.** The two sides are using different
credentials. This almost always means a rotation was applied on one side only: the backend takes its
keys from configuration, Databricks from a secret scope, and they are updated by separate mechanisms.

**`missing-signature`.** The caller sent a key id but did not sign. That is a client regression or a
request that reached the guarded route by a path that bypasses the signing client, not a credential
problem.

**`bad-signature`.** Same key id, different secret, or the payload was altered in transit. Check
whether the secret scope value matches what the backend expects before suspecting anything exotic.

**`stale-timestamp`.** The request is outside the five-minute replay window. This is clock drift or a
genuinely slow call, and it is the only reason that can resolve on its own.

**`internal-error`.** The guard itself failed, for example reading its configuration, and the call
got a server error. `backend-5xx` usually fires alongside.

A 403 never reaches the guard: it is the backend's WAF refusing the call first, and it shows only in
the pipeline's errors (see `macro-failures`).

## When nothing reaches the backend

Read the failure from the pipeline side: the client that makes these calls reports the HTTP status
it got. A DNS or base-URL problem looks completely different from a rejection and is usually the
result of an environment's backend URL changing.

## Closing

Note which direction and which reason. Rotation-shaped failures recur on the next rotation, and the
fix is to rotate both sides together rather than to re-fix the symptom.
