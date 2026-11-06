# Play review sign-in

Generates the address and the six-digit code that Google Play's reviewers sign in with, for one environment, and keeps them in their own Secrets Manager secret, `openjii-play-review-sign-in-<env>`. The backend gives that address the fixed code instead of emailing one (`packages/auth/src/email-otp.ts`). A metric filter on the backend's log group counts every sign-in to the account and every refused attempt to add a sign-in method as `OpenJII/Backend` `PlayReviewAccountUse`, which catalog entry `play-review-account-use` alerts on.

## Usage

```hcl
module "play_review_sign_in" {
  source = "../../modules/play-review-sign-in"

  enabled        = true
  environment    = var.environment
  domain_name    = var.domain_name
  log_group_name = module.backend_ecs.cloudwatch_log_group_name
}
```

Add `ecs_secrets` to the backend task's `secrets`, as `infrastructure/env/prod/main.tf` does. With `enabled = false` there is no secret and the list is empty, so the backend gets neither setting and review sign-in stays off. A change of `enabled` reaches the backend only when it next deploys, because the ECS service ignores task definition changes, so run the backend deployment right after the apply. In an incident, rotate the code and revoke as below rather than turning it off. The metric filter exists either way. The generated values stay in state either way too, so turning it off and on again keeps the same address and code.

## Inputs

| Name               | Description                                                 | Type          | Default |
| ------------------ | ----------------------------------------------------------- | ------------- | ------- |
| `enabled`          | Whether the backend gives the review address its fixed code | `bool`        | none    |
| `environment`      | Environment name, used in the secret's name                 | `string`      | none    |
| `log_group_name`   | The backend's log group, where the account's use is counted | `string`      | none    |
| `domain_name`      | Domain of the generated review address                      | `string`      | none    |
| `email_generation` | Bump to replace the address, which means a new account      | `number`      | `1`     |
| `otp_generation`   | Bump to rotate the code                                     | `number`      | `1`     |
| `tags`             | Tags for the secret                                         | `map(string)` | `{}`    |

## Outputs

| Name          | Description                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------- |
| `ecs_secrets` | `AUTH_PLAY_REVIEW_EMAIL` and `AUTH_PLAY_REVIEW_OTP` as backend task secrets, empty when off |

## Setting up the account

Nothing creates the account. Set it up once per environment, and again after every `email_generation` bump.

1. Read the address and the code from the `openjii-play-review-sign-in-<env>` secret, sign in with them on the web app, and complete registration.
2. Create the demo experiment in the account's own personal organization, the one every account gets.
3. Never invite the address into any other organization, and never approve a join request from it. An invitation to an address is accepted at its next sign-in, and every holder of the code would then have that organization's role.
4. After setup, and on every alert, check what the account belongs to:

   ```sql
   SELECT o.slug, m.role
   FROM organization_members m
   JOIN organizations o ON o.id = m.organization_id
   WHERE m.user_id = (SELECT id FROM users WHERE email = '<address>');
   ```

   It should return one row: `personal-<the account's user id>`, as `owner`. Any other row is an organization the code reaches.

The auth server refuses the account any new sign-in method: a passkey, an API key, a linked GitHub or ORCID account, or an email change. A session is its only way in.

## Rotating the code

The backend reads both values when a task starts, and the ECS service ignores task definition changes, so a new value reaches the backend only with the next deploy. A new code ends no session, so every rotation also revokes the account. Google can test sign-in at any point of a review, so never rotate while a submission is in review.

1. Bump `otp_generation` in the environment's module call, get the PR approved, and apply.
2. Force a new backend deployment.
3. Revoke everything the account holds, against the environment's database:

   ```sql
   DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = '<address>');
   DELETE FROM passkeys WHERE user_id = (SELECT id FROM users WHERE email = '<address>');
   DELETE FROM api_keys WHERE reference_id = (SELECT id FROM users WHERE email = '<address>');
   DELETE FROM accounts WHERE user_id = (SELECT id FROM users WHERE email = '<address>') AND provider_id IN ('github', 'orcid');
   ```

   A deleted session can still pass for up to a day, because the auth server caches sessions in a cookie for that long (`session.cookieCache` in `packages/auth/src/server.ts`).

4. Read the new code from the secret and check that it signs in.
5. Change the code in Play Console's Sign-in details, in the password field and the instructions, and send the change for review.

Bump `email_generation` only if the address has leaked. A new address is a new account, so set it up as above before Play Console gets it.
