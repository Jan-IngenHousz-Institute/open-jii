# webhook-failures

**HMAC-authenticated traffic between Databricks and the backend is failing.** The pipeline calls the
backend to resolve user metadata, execute macro batches and look up the device registry; the backend
is called back for project transfers. A break here does not stop ingestion, it silently degrades
enrichment, which is why it is worth an alarm rather than a dashboard.

## Establish the direction

```bash
aws logs tail /ecs/backend-<env> --since 1h --filter-pattern "HmacGuard"
```

Rejections logged by the backend mean Databricks called and was refused. Silence in the backend
while the pipeline reports failures means the call never arrived, which is a network or URL problem
rather than an authentication one.

## The three rejection reasons are diagnostic

The guard distinguishes them, and each points somewhere different.

**Unknown key id.** The two sides are using different credentials. This almost always means a
rotation was applied on one side only: the backend takes its keys from configuration, Databricks
from a secret scope, and they are updated by separate mechanisms.

**Bad signature.** Same key id, different secret, or the payload was altered in transit. Check
whether the secret scope value matches what the backend expects before suspecting anything exotic.

**Stale timestamp.** The request is outside the replay window. This is clock drift or a genuinely
slow call, and it is the only one of the three that can resolve on its own.

## When nothing reaches the backend

Read the failure from the pipeline side: the client that makes these calls reports the HTTP status
it got. A DNS or base-URL problem looks completely different from a rejection and is usually the
result of an environment's backend URL changing.

## Closing

Note which direction and which reason. Rotation-shaped failures recur on the next rotation, and the
fix is to rotate both sides together rather than to re-fix the symptom.
