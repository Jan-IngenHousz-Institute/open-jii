terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 3.49.0"
    }
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

locals {
  uc_iam_role    = var.iam_role_name
  aws_account_id = data.aws_caller_identity.current.account_id
}

# Create S3 bucket for Unity Catalog metastore
resource "aws_s3_bucket" "metastore" {
  bucket        = var.bucket_name
  force_destroy = var.force_destroy
  tags          = var.tags
}

# Configure S3 bucket versioning
resource "aws_s3_bucket_versioning" "versioning" {
  bucket = aws_s3_bucket.metastore.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Block public access to the S3 bucket
resource "aws_s3_bucket_public_access_block" "public_access" {
  bucket                  = aws_s3_bucket.metastore.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Configure server-side encryption for the S3 bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
  bucket = aws_s3_bucket.metastore.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Create IAM role for Unity Catalog
resource "aws_iam_role" "unity_catalog_access" {
  name = local.uc_iam_role

  # Use basic assume role policy initially - will be updated later
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Service = "databricks.amazonaws.com"
        },
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = var.tags
}

# Create storage credential referencing the IAM role
resource "databricks_storage_credential" "this" {
  provider = databricks.workspace
  name     = var.storage_credential_name

  aws_iam_role {
    role_arn = aws_iam_role.unity_catalog_access.arn
  }

  comment = "Managed by Terraform"
}

# Update IAM role trust relationship with the external ID from the storage credential
resource "aws_iam_role_policy_document" "assume_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["databricks.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [databricks_storage_credential.this.aws_iam_role[0].external_id]
    }
  }
}

resource "aws_iam_role_policy_attachment" "external_id_update" {
  role       = aws_iam_role.unity_catalog_access.name
  policy_arn = aws_iam_policy.unity_catalog_access.arn

  depends_on = [databricks_storage_credential.this]
}

resource "null_resource" "update_assume_role_policy" {
  triggers = {
    external_id = databricks_storage_credential.this.aws_iam_role[0].external_id
  }

  provisioner "local-exec" {
    command = <<EOF
      aws iam update-assume-role-policy \
        --role-name ${aws_iam_role.unity_catalog_access.name} \
        --policy-document '${aws_iam_role_policy_document.assume_role_policy.json}'
    EOF
  }

  depends_on = [databricks_storage_credential.this]
}

# Get the Unity Catalog IAM policy for the S3 bucket
data "databricks_aws_unity_catalog_policy" "this" {
  aws_account_id = local.aws_account_id
  bucket_name    = aws_s3_bucket.metastore.id
  role_name      = local.uc_iam_role
}

# Create IAM policy using the Databricks-recommended policy
resource "aws_iam_policy" "unity_catalog_access" {
  name        = "${var.iam_role_name}-policy"
  description = "Policy for Unity Catalog to access S3 bucket"
  policy      = data.databricks_aws_unity_catalog_policy.this.json
}

# Attach the policy to the role
resource "aws_iam_role_policy_attachment" "unity_catalog_attachment" {
  role       = aws_iam_role.unity_catalog_access.name
  policy_arn = aws_iam_policy.unity_catalog_access.arn
}

# Create external location in Unity Catalog if specified
resource "databricks_external_location" "this" {
  provider        = databricks.workspace
  count           = var.create_external_location ? 1 : 0
  name            = var.external_location_name
  url             = "s3://${aws_s3_bucket.metastore.id}/${var.external_location_path}"
  credential_name = databricks_storage_credential.this.id
  comment         = "Managed by Terraform"
}

# Grant permissions to the external location if specified
resource "databricks_grants" "external_location" {
  provider          = databricks.workspace
  count             = var.create_external_location ? 1 : 0
  external_location = databricks_external_location.this[0].id

  dynamic "grant" {
    for_each = var.external_location_grants
    content {
      principal  = grant.value.principal
      privileges = grant.value.privileges
    }
  }
}
