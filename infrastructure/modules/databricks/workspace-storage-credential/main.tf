terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

data "aws_caller_identity" "current" {}

# Create storage credential using workspace provider
resource "databricks_storage_credential" "this" {
  provider = databricks.workspace

  name           = var.credential_name
  isolation_mode = var.isolation_mode
  force_update   = true

  aws_iam_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.role_name}"
  }

  comment = "Managed by Terraform - ${var.environment} workspace access to centralized metastore"
}

# Create IAM role for workspace's storage access
resource "aws_iam_role" "storage_access" {
  name = var.role_name

  assume_role_policy = data.databricks_aws_unity_catalog_assume_role_policy.this.json

  tags = {
    Name        = "${var.environment} Unity Catalog storage access IAM role"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Get Unity Catalog assume role policy
data "databricks_aws_unity_catalog_assume_role_policy" "this" {
  aws_account_id = data.aws_caller_identity.current.account_id
  role_name      = var.role_name
  external_id    = databricks_storage_credential.this.aws_iam_role[0].external_id
}

# Create Unity Catalog IAM policy locally in this environment
data "databricks_aws_unity_catalog_policy" "this" {
  aws_account_id = data.aws_caller_identity.current.account_id
  bucket_name    = var.bucket_name
  role_name      = var.role_name
}

# Create IAM policy for Unity Catalog access
resource "aws_iam_policy" "storage_access" {
  name   = "${var.role_name}-policy"
  policy = data.databricks_aws_unity_catalog_policy.this.json

  tags = {
    Name        = "${var.environment} Unity Catalog storage access IAM policy"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Attach the locally created IAM policy to the role
resource "aws_iam_role_policy_attachment" "storage_access" {
  role       = aws_iam_role.storage_access.name
  policy_arn = aws_iam_policy.storage_access.arn
}

# Attach any additional policies (e.g. large-iot S3 read for Databricks Auto Loader)
resource "aws_iam_role_policy_attachment" "additional" {
  count = length(var.additional_policy_arns)

  role       = aws_iam_role.storage_access.name
  policy_arn = var.additional_policy_arns[count.index]
}

# Policies for extra buckets registered as external locations (e.g. file share).
# Buckets are SSE-S3 across the estate, so no KMS permissions are needed here.
resource "aws_iam_policy" "additional_bucket_access" {
  for_each = var.additional_bucket_access

  name = "${var.role_name}-${each.key}-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = each.value.read_only ? [
          "s3:GetObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
          ] : [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          "arn:aws:s3:::${each.value.bucket_name}",
          "arn:aws:s3:::${each.value.bucket_name}/*"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.environment} Unity Catalog ${each.key} bucket access IAM policy"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_iam_role_policy_attachment" "additional_bucket_access" {
  for_each = var.additional_bucket_access

  role       = aws_iam_role.storage_access.name
  policy_arn = aws_iam_policy.additional_bucket_access[each.key].arn
}