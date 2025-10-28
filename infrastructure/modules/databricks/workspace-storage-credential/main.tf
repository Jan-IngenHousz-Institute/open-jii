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
  
  name = var.credential_name

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