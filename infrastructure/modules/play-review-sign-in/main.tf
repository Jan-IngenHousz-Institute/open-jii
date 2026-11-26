locals {
  secret_names = ["AUTH_PLAY_REVIEW_EMAIL", "AUTH_PLAY_REVIEW_OTP"]
}

# OpenTofu creates the secret without a value. The address and the code are set with
# `pnpm secrets:set <env> play-review`, so neither reaches a plan or the state. They live only in
# this secret, so deleting it keeps the usual recovery window.
module "secret" {
  source = "../secrets-manager/container"
  count  = var.enabled ? 1 : 0

  name        = "openjii-play-review-sign-in-${var.environment}"
  description = "Address and fixed sign-in code for Google Play's reviewers"

  tags = var.tags
}

# Every sign-in to the review account, failed, refused or successful, and every refused attempt
# to add a sign-in method. Outside a review, any of them means someone else has the address or the
# code. The terms are PLAY_REVIEW_LOG_LINES in packages/auth/src/email-otp.ts, and the info line
# that issues the code matches none of them.
resource "aws_cloudwatch_log_metric_filter" "account_use" {
  name           = "play-review-account-use-${var.environment}"
  log_group_name = var.log_group_name
  pattern        = "?\"Play review sign-in succeeded\" ?\"Play review sign-in failed\" ?\"Play review sign-in refused\" ?\"Play review account refused a new sign-in method\""

  metric_transformation {
    name          = "PlayReviewAccountUse"
    namespace     = "OpenJII/Backend"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}
