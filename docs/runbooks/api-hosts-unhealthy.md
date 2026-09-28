# api-hosts-unhealthy

**The load balancer has taken at least one API task out of service.** It asks each task for
`/health` every 90 seconds and marks it unhealthy after three failures, so a task has failed for
about four and a half minutes before this fires. The service normally runs a single task, so one
unhealthy host is usually the whole API down.

## What the health check proves

`/health` (`apps/backend/src/health/health.controller.ts`) returns ok without touching the database
or any other dependency. A task that fails it is not answering HTTP at all: crashed, restarting,
out of memory or stuck. A database outage does not show here; see `backend-5xx`.

## Look at the tasks

The cluster and service are the dimensions on this entry's chart in the daily report.

```bash
aws ecs describe-services --cluster <cluster> --services <service> \
  --query 'services[0].[runningCount,desiredCount,events[:10].[createdAt,message]]'
aws ecs list-tasks --cluster <cluster> --service-name <service> --desired-status STOPPED
aws ecs describe-tasks --cluster <cluster> --tasks <task-arn> \
  --query 'tasks[0].[stoppedReason,containers[0].exitCode,containers[0].reason]'
```

## Likely causes, most common first

- **A deploy whose tasks do not start.** The deployment circuit breaker rolls a failing deploy
  back, so tasks cycling right after a merge are the new image failing its container health check
  (60 seconds' grace). The service events say so, and the stopped task's reason names why.
- **Out of memory.** Each task has 1 GiB. Exit code 137 with an out-of-memory reason is this.
  Memory also drives autoscaling at 80%, so a steady climb shows on the Platform dashboard first.
- **A Spot interruption.** The first task runs on regular Fargate; tasks the service scales out to
  run mostly on Fargate Spot. An interrupted Spot task is unhealthy until its replacement starts,
  and this clears on its own.

## Closing

Note the stopped reason. Confirm the running count matches the desired count and the target group
shows every target healthy before closing.
