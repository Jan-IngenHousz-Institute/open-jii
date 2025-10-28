terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.mws]
    }

  }
}

data "aws_caller_identity" "current" {}
locals {
  uc_iam_role = "open-jii-db-uc-access"
}

# Create S3 bucket for Unity Catalog metastore
resource "aws_s3_bucket" "external" {
  bucket = var.bucket_name

  # lifecycle {
  #   prevent_destroy = true
  # }
}

# Configure S3 bucket versioning
resource "aws_s3_bucket_versioning" "versioning" {
  bucket = aws_s3_bucket.external.id

  versioning_configuration {
    status = "Disabled"
  }
}

# Block public access to the S3 bucket
resource "aws_s3_bucket_public_access_block" "public_access" {
  bucket                  = aws_s3_bucket.external.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Configure server-side encryption for the S3 bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
  bucket = aws_s3_bucket.external.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Create a basic IAM policy template for Unity Catalog access to this bucket
# This will be used by storage credentials created in individual workspaces
data "databricks_aws_unity_catalog_policy" "this" {
  aws_account_id = data.aws_caller_identity.current.account_id
  bucket_name    = aws_s3_bucket.external.id
  role_name      = local.uc_iam_role
}

# Create IAM policy using the Databricks-recommended policy
resource "aws_iam_policy" "external_data_access" {
  name   = "${local.uc_iam_role}-policy"
  policy = data.databricks_aws_unity_catalog_policy.this.json
  tags = {
    Name = "open-jii-unity-catalog external access IAM policy"
  }
}

# Cross-account bucket policy to allow workspace account roles to access this bucket
resource "aws_s3_bucket_policy" "cross_account_access" {
  count  = length(var.cross_account_role_arns) > 0 ? 1 : 0
  bucket = aws_s3_bucket.external.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CrossAccountUnityAccess"
        Effect = "Allow"
        Principal = {
          AWS = var.cross_account_role_arns
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:ListBucketMultipartUploads",
          "s3:ListMultipartUploadParts",
          "s3:AbortMultipartUpload"
        ]
        Resource = [
          aws_s3_bucket.external.arn,
          "${aws_s3_bucket.external.arn}/*"
        ]
      }
    ]
  })
}

# Note: IAM role creation and storage credential creation are handled per-workspace
# This module only creates the S3 bucket and base IAM policy that can be referenced by workspaces
