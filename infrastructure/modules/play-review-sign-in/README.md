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

Add `ecs_secrets` to the backend task's `secrets`, as `infrastructure/env/prod/main.tf` does. With `enabled = false` there is no secret and the list is empty, so the backend gets neither setting and review sign-in stays off. The metric filter exists either way. The generated values stay in state either way too, so turning it off and on again keeps the same address and code.

## Inputs

| Name               | Description                                                 | Type          | Default |
| ------------------ | ----------------------------------------------------------- | ------------- | ------- |
| `enabled`          | Whether the backend gives the review address its fixed code | `bool`        | none    |
| `environment`      | Environment name, used in the secret's name                 | `string`      | none    |
| `log_group_name`   | The backend's log group, where failures are counted         | `string`      | none    |
| `domain_name`      | Domain of the generated review address                      | `string`      | none    |
| `email_generation` | Bump to replace the address, which means a new account      | `number`      | `1`     |
| `otp_generation`   | Bump to rotate the code                                     | `number`      | `1`     |
| `tags`             | Tags for the secret                                         | `map(string)` | `{}`    |

## Outputs

| Name          | Description                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------- |
| `ecs_secrets` | `AUTH_PLAY_REVIEW_EMAIL` and `AUTH_PLAY_REVIEW_OTP` as backend task secrets, empty when off |

## Rotating the code

The backend reads both values when a task starts, and the ECS service ignores task definition changes, so a new value reaches the backend only with the next deploy. Google can test sign-in at any point of a review, so never rotate while a submission is in review.

1. Bump `otp_generation` in the environment's module call, get the PR approved, and apply.
2. Force a new backend deployment.
3. Read the new code from the `openjii-play-review-sign-in-<env>` secret and check that it signs in.
4. Change the code in Play Console's Sign-in details, in the password field and the instructions, and send the change for review.

Bump `email_generation` only if the address has leaked. A new address is a new account, which has to be set up again before Play Console gets it.
