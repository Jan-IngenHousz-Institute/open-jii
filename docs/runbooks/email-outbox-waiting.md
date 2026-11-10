# email-outbox-waiting

**A notification email has waited in the outbox for over 15 minutes.** The backend queues every
notification email as a row in `notification_deliveries`, and the worker on each task sends them
one at a time. A row is waiting while it is `pending` or `sending`. Every five minutes each task
publishes `NotificationEmailsWaiting`, how many rows are waiting, and
`NotificationEmailOldestWaitingSeconds`, how long since the oldest of them was queued (its
`created_at`, on the database's clock). The age is 0 when nothing waits. The rule fires when the
age stays above 900 seconds for 5 minutes. An email usually leaves within a second of being queued.

## One old email, or all of them

The entry's chart and `NotificationEmailsWaiting` beside it in CloudWatch tell the two cases apart:

- **The count climbs with the age:** nothing is leaving. Almost always the mail relay.
- **The count stays low and one age climbs:** one email fails on every attempt while the rest go
  out. A row waits 1, 5, 15 and 60 minutes between its five attempts, so it passes 15 minutes in
  the wait after its third failure and stays past it until it is sent or given up on.

List what is waiting, oldest first, from a database session:

```sql
select id, status, attempts, next_attempt_at, last_error, created_at
from notification_deliveries
where status in ('pending', 'sending')
order by created_at
limit 50;
```

## The relay is down

Every row waits with `attempts` unchanged and a connection error in `last_error`, and the worker
logs a warning for each one it puts back:

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 1h --filter-pattern '{ $.msg = "Mail relay unreachable*" }'
```

`dependency-health` checks the same relay every five minutes, so its `email` series reads 0 too.
That runbook covers the SMTP login and SES itself. Nothing is lost while the relay is down: an
unreachable relay costs a row none of its attempts, and the backlog drains on the first poll after
the relay answers. Sign-in codes and invitations go out on their own over the same SES login, so
they are probably failing as well, and nothing queues them.

## One email fails on every attempt

`attempts` climbs on that row and `last_error` carries the server's rejection, such as an SMTP 5xx
for a bad address or a message the server refused. The worker logs each one:

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 2h --filter-pattern '{ $.msg = "A notification email attempt failed" }'
```

The fifth failure turns the row `failed` and the age drops back. That email is not sent, and
nothing replays it: the in-app notification is still there, and if the email mattered, the
recipient has to be told some other way. `email-failures` counts these.

## Closing

Do not close until the age has read 0 for 15 minutes.
