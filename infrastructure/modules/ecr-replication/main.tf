data "aws_caller_identity" "current" {}

# aws_ecr_replication_configuration is an account-level singleton — only one
# can exist per AWS account. Managing it here (rather than inside individual
# ECR repository modules) ensures a single apply never silently overwrites the
# replication rules for other repositories in the same account.
# Note: ECR auto-creates destination repositories on the first image push with
# default settings (mutable tags, no lifecycle policy). Adjust manually in the
# DR region if stricter settings are required.
resource "aws_ecr_replication_configuration" "this" {
  replication_configuration {
    rule {
      destination {
        region      = var.dr_region
        registry_id = data.aws_caller_identity.current.account_id
      }

      dynamic "repository_filter" {
        for_each = var.repository_names
        content {
          # PREFIX_MATCH on the exact name acts as an exact match because ECR
          # repository names cannot contain the "/" separator at the root level.
          filter      = repository_filter.value
          filter_type = "PREFIX_MATCH"
        }
      }
    }
  }
}
