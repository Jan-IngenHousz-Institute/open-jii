# email-failures

**The outbox gave up on a notification email, and nobody will get it.** The worker counts
`NotificationEmails` with `Outcome=failed` once for each row it gives up on. A row is given up on
after five counted attempts: a send the server refused, a send that took longer than three minutes,
or a task that claimed it and died. Those five attempts end about eighty minutes after the first.
A relay that cannot be reached costs a row no attempts, so an outage alone never fails one; it
shows as `email-outbox-waiting` instead. This entry is red on the daily report from the first
failure and has no Slack rule.

## What failed, and why

The reason is on the row:

```sql
select d.id, n.type, d.attempts, d.last_error, d.updated_at
from notification_deliveries d
join notifications n on n.id = d.notification_id
where d.status = 'failed'
order by d.updated_at desc
limit 50;
```

- **An SMTP rejection:** SES refused the message while it was being handed over, and the text says
  why, often the address or the message's size. A bounce from the recipient's server comes later
  and never shows here; `email-bounce-rate` counts those.
- **`Attempt exceeded 180 s`:** a send that hung. One is noise; many at once point at the relay
  being slow rather than down.
- **`Gave up after 5 attempts`:** the row was claimed and abandoned five times, which means tasks
  died or stalled while sending it. Read the backend's logs around those times.
- **This build cannot render the row:** `Unknown notification type …`,
  `No email for notification type …` or `Stored params do not match the type's schema`. It happens
  after a deploy that dropped or renamed a notification type or its params. Each attempt logs at
  `warn` in case a newer build that can render it is rolling out; when none ever does, the row
  fails like any other after about eighty minutes.
- **`Recipient has no deliverable email address`:** the outbox sets such a row aside as `skipped`,
  and it never reaches `failed`. One here is a bug.

The worker logs the moment it gives up:

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 1d --filter-pattern '{ $.msg = "Gave up on a notification email" }'
```

## What the recipient sees

The in-app notification behind the email is untouched, so the person still sees it in the bell.
Nothing replays a failed email. If it carried something the recipient needed, tell them some other
way.

## Closing

Do not close until the daily report has shown a day with none.
