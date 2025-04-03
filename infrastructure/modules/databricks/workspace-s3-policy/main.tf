terraform {
  required_providers {
    databricks = {
      source  = "databricks/databricks"
      version = ">= 1.13.0"
    }
  }
}

data "databricks_aws_bucket_policy" "this" {
  bucket = var.bucket_name
}
