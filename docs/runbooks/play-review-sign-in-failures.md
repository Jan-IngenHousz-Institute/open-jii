# play-review-sign-in-failures

**A sign-in for the Google Play review account failed or was refused.** The review address signs in
with a fixed six-digit code and no email goes out, so nothing else would show someone trying codes
against it. Reviewers paste the code from Play Console, which makes a failure most likely someone
else. The auth server refuses the address after ten attempts a day per backend task, and logs every
failure with its reason but never the address (`packages/auth/src/email-otp.ts`).

## See what happened

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 1h --filter-pattern '?"Play review sign-in failed" ?"Play review sign-in refused"'
```

A failed line carries Better Auth's reason. `INVALID_OTP` is a wrong code, `TOO_MANY_ATTEMPTS` is the
code's own limit of three tries, and `OTP_EXPIRED` is a code requested more than five minutes before.
A refused line means the day's cap is used up, and the address cannot sign in on that task until
the next UTC day, the reviewer included.

Then check whether a review is running. Play Console's Publishing overview shows a submission in
review, and a reviewer can mistype once or twice.

## What to do

A failure or two while a review is running is most likely the reviewer, and needs nothing.

Failures with no review running, or a refused line, mean someone has the address. Rotate the code
as the module README describes (`infrastructure/modules/play-review-sign-in/README.md`): bump
`otp_generation`, apply, force a new backend deployment, and update Play Console. If the failures
carry on after the rotation and keep using up the cap, replace the address with `email_generation`
as well. A new address is a new account, so it has to be set up again before Play Console gets it.

If anyone may have signed in, sign in as the account with the new code, check its email address is
unchanged, revoke its API keys and passkeys, and end its sessions. A new code does not end any of
them.

## Closing

Say in the alert's Slack thread whether a review was running, what you rotated, and whether anyone
signed in.
