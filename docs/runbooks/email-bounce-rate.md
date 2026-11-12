# email-bounce-rate

**The account's bounce rate is nearing the line where AWS reviews it.** SES publishes
`Reputation.BounceRate` to `AWS/SES` for the whole account: the share of a representative volume
of recent mail that bounced. SES picks that volume itself, so the figure cannot be recomputed from
sends and bounces. AWS places an account under review at 5% and may pause its sending at 10%. The
rule fires above 4% for 15 minutes. With too little mail sent, SES publishes nothing, which is why
no data is quiet.

Every email the account sends counts, sign-in codes included. A pause stops those too, and
invitations with them: people who sign in with a code cannot, while OAuth and passkey sign-in keep
working.

## Where to read it

The account's standing, with its sending quota and suppression settings:

```bash
aws sesv2 get-account --profile openjii-<env>
```

`EnforcementStatus` reads `HEALTHY`, `PROBATION` or `SHUTDOWN`. The SES console's Reputation
metrics page shows the same rate over time, with what AWS has written about any review.

## What usually causes it here

- **One batch to stale addresses.** A notification sent to many accounts at once, some with
  addresses that no longer exist. Check which type's deliveries spiked:

```sql
select n.type, count(*) as emails
from notification_deliveries d
join notifications n on n.id = d.notification_id
where d.created_at > (now() at time zone 'UTC') - interval '2 days'
group by n.type
order by emails desc;
```

- **A typo'd or throwaway address on a new account**, which bounces once per email it is sent.

The account's suppression list holds every address that bounced and stops further sends to it, so
a bad address bounces once rather than every time. Confirm it is on in `get-account`'s
`SuppressionAttributes`: it should list `BOUNCE` and `COMPLAINT`.

## Closing

Do not close until the rate has stayed below 4% for a day and `EnforcementStatus` reads `HEALTHY`.
