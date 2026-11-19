# sign-in-emails-failed

**An email with a sign-in code failed to send.** Signing in, registering and verifying an address all
mail a six-digit code. When the email server does not take the message, the auth server logs
`Sign-in code email failed` with the code's type but never the address
(`packages/auth/src/email-otp.ts`), and a metric filter on the backend's log group counts the line.
Better Auth still answers that the code was sent, so the person waits for an email that never comes. The status page shows Platform degraded while three or more failed in the last 15 minutes, so one failure alerts here before the page changes.

## See what happened

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 1h --filter-pattern '"Sign-in code email failed"'
```

Each line carries the code's type and the email server's error code, such as `EAUTH` for refused
credentials or `ECONNECTION` for a server that did not answer.

## Likely causes, most common first

- **The email server is down or refusing us.** `dependency-health` checks it every five minutes, so
  it usually fires too. See `dependency-health.md`.
- **The sending account is throttled or suspended.** A high bounce or complaint rate can pause it.
  See `email-bounce-rate.md` and `email-complaint-rate.md`.
- **The server's settings are wrong.** `AUTH_EMAIL_SERVER` or `AUTH_EMAIL_FROM` changed with a
  deploy. The backend's task definition shows which values it runs with.

## Closing

Say in the alert's Slack thread what the email server answered and when sending recovered. Anyone
who waited for a code then can ask for a new one.
