# backend-5xx

**The API is returning server errors well above its normal rate.** Users see failed requests
directly, so this is the most user-visible metric in the program.

## Correlate with deploys before anything else

Most 5xx spikes start at a deploy. Compare the onset against recent merges:

```bash
git log --since="6 hours ago" --oneline origin/main
```

If the onset matches a deploy, decide whether to roll back before continuing to diagnose. Rolling
back first and understanding second is the right order when users are affected.

## Read the errors

```bash
aws logs tail /ecs/backend-<env> --since 1h --filter-pattern '{ $.level >= 50 }'
```

The backend logs structured JSON through pino, so filtering on level gets errors without matching
the word "error" in unrelated messages. What you are looking for is whether one code path dominates
or the failures are spread across many.

## The three usual shapes

**One endpoint, one error.** A code defect. The stack trace names it, and the deploy correlation
above usually names the commit.

**Every endpoint, database-shaped errors.** Check `aurora-vitals` and the Aurora console. The shared
client is pinned to a single connection per process, so a slow query does not merely slow one
request, it queues every other request in that task behind it. Under that condition the symptom is
broad and the cause is narrow.

**Only lakehouse-backed endpoints.** Data pages, exports and visualizations fail while the rest of
the API is fine. That is the warehouse, not the backend: check `dbx-sql-from-backend` and whether
the SQL warehouse is awake. A warehouse that has scaled to zero makes the first request after idle
pay the resume, which surfaces as timeouts rather than as errors.

## Closing

Note which shape it was. The three have almost nothing in common except the metric that reported
them, and knowing the shape is most of the diagnosis next time.
