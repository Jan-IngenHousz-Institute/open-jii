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
  provider = databricks.workspace
  name     = var.catalog_name
  comment  = var.catalog_comment
}
