# api-cpu

**The API's tasks average above 80% of their CPU.** Each task has half a vCPU, and the service
scales on the same 80% target, from one task up to three, adding one within about a minute of
crossing it. A reading that stays above 80% therefore means scaling has run out of room at three
tasks, or cannot keep up with a burst.

## Check capacity first

```bash
aws ecs describe-services --cluster <cluster> --services <service> \
  --query 'services[0].[desiredCount,runningCount]'
```

Three running is the ceiling. Fewer than three with CPU still high means a burst that scaling is
still catching up with.

## Likely causes, most common first

- **A traffic burst.** Compare with Traffic on the Platform dashboard. A burst that scaling absorbs
  within minutes needs nothing.
- **One expensive endpoint.** CPU climbing while traffic stays flat is work on a hot path: large
  serialisation, a CPU-bound transform, a loop over a big result. The Latency chart on Platform
  shows the API's p95 rising with it, and the backend logs name the operation.
- **Three tasks and still high.** That is a capacity decision: raise `max_capacity` or the task
  size for the backend service in `infrastructure/env/<env>/main.tf`. Confirm it recurs before
  paying for it.

## Closing

Note whether it was traffic or one operation, and which.
