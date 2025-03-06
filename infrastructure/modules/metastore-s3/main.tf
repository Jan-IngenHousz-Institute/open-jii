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

# Step 1: Create storage credential first to get the external ID
resource "databricks_storage_credential" "external" {
  provider = databricks.workspace
  name     = "open-jii-db-external-access"

  aws_iam_role {
    role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${local.uc_iam_role}"
  }

  comment = "Managed by Terraform"
}

# Step 2: Get the Unity Catalog assume role policy for the IAM role with the external ID
data "databricks_aws_unity_catalog_assume_role_policy" "this" {
  aws_account_id = data.aws_caller_identity.current.account_id
  role_name      = local.uc_iam_role
  external_id    = databricks_storage_credential.external.aws_iam_role[0].external_id
}

# Step 3: Get the Unity Catalog IAM policy for the S3 bucket
data "databricks_aws_unity_catalog_policy" "this" {
  aws_account_id = data.aws_caller_identity.current.account_id
  bucket_name    = aws_s3_bucket.external.id
  role_name      = local.uc_iam_role
}

# Step 4: Create IAM policy using the Databricks-recommended policy
resource "aws_iam_policy" "external_data_access" {
  policy = data.databricks_aws_unity_catalog_policy.this.json
  tags = {
    Name = "open-jii-unity-catalog external access IAM policy"
  }
}

# Step 5: Create IAM role for Unity Catalog with proper assume role policy including external_id
resource "aws_iam_role" "external_data_access" {
  name               = local.uc_iam_role
  assume_role_policy = data.databricks_aws_unity_catalog_assume_role_policy.this.json

  tags = {
    Name = "open-jii-unity-catalog external access IAM role"
  }
}

# Step 6: Attach the policy to the role
resource "aws_iam_role_policy_attachment" "unity_catalog_attachment" {
  role       = aws_iam_role.external_data_access.name
  policy_arn = aws_iam_policy.external_data_access.arn
}

resource "databricks_external_location" "external" {
  provider        = databricks.workspace
  name            = "external"
  url             = "s3://${aws_s3_bucket.external.id}/external"
  credential_name = databricks_storage_credential.external.id
  comment         = "Managed by TF"
}
