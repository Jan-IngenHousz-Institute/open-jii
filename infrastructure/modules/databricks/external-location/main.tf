terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# Create external location using workspace provider
resource "databricks_external_location" "this" {
  provider = databricks.workspace
  
  name            = var.external_location_name
  url             = "s3://${var.bucket_name}/${var.external_location_path}"
  credential_name = var.storage_credential_name
  comment         = var.comment != "" ? var.comment : "Managed by Terraform - ${var.environment} external location"
}