module "terraform_state_s3" {
  source      = "../../modules/s3"
  bucket_name = "open-jii-terraform-state-${var.environment}"

  # Saved plans hold the configuration's secret values; an approved one is applied within hours.
  lifecycle_rules = [
    {
      id                                 = "expire-saved-plans"
      status                             = "Enabled"
      prefix                             = "plans/"
      transitions                        = []
      expiration_days                    = 7
      noncurrent_version_expiration_days = 1
    }
  ]

  providers = {
    aws    = aws
    aws.dr = aws.dr
  }
}

module "terraform_state_lock" {
  source     = "../../modules/dynamodb"
  table_name = "terraform-state-lock"
}

module "iam_oidc" {
  source     = "../../modules/iam-oidc"
  role_name  = "GithubActionsDeployAccess"
  repository = "Jan-IngenHousz-Institute/open-jii"
  aws_region = var.aws_region

  environment                        = var.environment
  github_environments                = [var.environment]
  allowed_refs                       = ["refs/heads/main", "refs/heads/release/*"]
  plan_role_github_environment       = "${var.environment}-plan"
  foundation_role_github_environment = "foundation-${var.environment}"
}
