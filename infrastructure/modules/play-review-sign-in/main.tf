resource "random_password" "email_local_part" {
  length  = 16
  upper   = false
  special = false

  keepers = {
    generation = var.email_generation
  }
}

# Six digits is all the app's code boxes accept.
resource "random_password" "otp" {
  length  = 6
  lower   = false
  upper   = false
  special = false

  keepers = {
    generation = var.otp_generation
  }
}

locals {
  secret_names = ["AUTH_PLAY_REVIEW_EMAIL", "AUTH_PLAY_REVIEW_OTP"]
}

# The values live in the random resources, so deleting the secret at once loses nothing and lets
# it be turned on again without waiting out a recovery window.
module "secret" {
  source = "../secrets-manager"
  count  = var.enabled ? 1 : 0

  name                    = "openjii-play-review-sign-in-${var.environment}"
  description             = "Address and fixed sign-in code for Google Play's reviewers"
  recovery_window_in_days = 0

  secret_string = jsonencode({
    AUTH_PLAY_REVIEW_EMAIL = "${random_password.email_local_part.result}@${var.domain_name}"
    AUTH_PLAY_REVIEW_OTP   = random_password.otp.result
  })

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
