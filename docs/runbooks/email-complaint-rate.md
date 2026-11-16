# email-complaint-rate

**The account's complaint rate is nearing the line where AWS reviews it.** SES publishes
`Reputation.ComplaintRate` to `AWS/SES` for the whole account: the share of a representative
volume of recent mail that recipients marked as spam. SES picks that volume itself, so the figure
cannot be recomputed from sends and complaints. AWS places an account under review at 0.1% and may
pause its sending at 0.5%. The rule fires above 0.08% for 15 minutes. With too little mail sent,
SES publishes nothing, which is why no data is quiet.

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

- **A notification people do not want.** A type sent more often, or to more people, than its
  recipients expect gets marked as spam. Check which type's deliveries spiked:

```sql
select n.type, count(*) as emails
from notification_deliveries d
join notifications n on n.id = d.notification_id
where d.created_at > (now() at time zone 'UTC') - interval '2 days'
group by n.type
order by emails desc;
```

- **Sign-in codes nobody asked for**, when someone enters other people's addresses on the sign-in
  page.

The account's suppression list holds every address that complained and stops further sends to it.
Confirm it is on in `get-account`'s `SuppressionAttributes`: it should list `BOUNCE` and
`COMPLAINT`. Notification emails carry an unsubscribe link, so someone who no longer wants a type
can turn it off rather than mark it as spam.

## Closing

Do not close until the rate has stayed below 0.08% for a day and `EnforcementStatus` reads
`HEALTHY`.
