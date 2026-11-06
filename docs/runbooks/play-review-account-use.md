# play-review-account-use

**Someone used the Google Play review account.** The review address signs in with a fixed six-digit
code and no email goes out, so nothing else would show who uses it. The auth server logs every sign-in
to it, failed, refused or successful, and every refused attempt to add a sign-in method, with a reason
but never the address (`packages/auth/src/email-otp.ts`). Google's reviewers paste the code from Play
Console, so outside a review any of these means someone else has the address or the code.

Each backend task refuses the address after ten sign-in attempts, counted from when the task started
and reset each UTC day, so a deployment or a replaced task starts at zero. Once a task's count is used
up, the right code is refused there too, Google's reviewers included, until the next UTC day.

## See what happened

```bash
aws logs tail /aws/ecs/backend-service-<env> --since 1h --filter-pattern '?"Play review sign-in succeeded" ?"Play review sign-in failed" ?"Play review sign-in refused" ?"Play review account refused a new sign-in method"'
```

- **Succeeded** is a sign-in with the right code.
- **Failed** carries Better Auth's reason: `INVALID_OTP` is a wrong code, `TOO_MANY_ATTEMPTS` is the
  code's own limit of three tries, and `OTP_EXPIRED` is a code requested more than five minutes before.
- **Refused** is the daily cap.
- **A refused new sign-in method** names the path: a passkey, an API key, a linked account or an email
  change. Only a signed-in session can get that far, so someone has the code.

Then check whether a review is running. Play Console's Publishing overview shows a submission in
review, and a reviewer can mistype once or twice.

## What to do

Sign-ins while a review is running are most likely Google's reviewers, and need nothing.

Anything else means the code or the address is out. Rotate the code and revoke the account's
sessions, passkeys and API keys as the module README describes
(`infrastructure/modules/play-review-sign-in/README.md`, "Rotating the code"). A new code ends none of
them on its own. If failures carry on after the rotation and keep using up the cap, replace the
address with `email_generation` as well, and set up the new account as the README's "Setting up the
account" describes.

Then run the membership check from the README's "Setting up the account". The account should belong
to its personal organization only. Any other row is an organization whose data the code has reached.

## Closing

Say in the alert's Slack thread whether a review was running, what you rotated and revoked, and what
the membership check returned.
