terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# The databricks_catalog resource creates a Unity Catalog catalog
resource "databricks_catalog" "this" {
  provider     = databricks.workspace
  name         = var.catalog_name
  comment      = var.catalog_comment
  storage_root = "s3://${var.external_bucket_id}/external"
}

# Grant permissions on the catalog
resource "databricks_grant" "catalog" {
  provider = databricks.workspace
  for_each = var.grants

  catalog    = databricks_catalog.this.name
  principal  = each.value.principal
  privileges = each.value.privileges
}
