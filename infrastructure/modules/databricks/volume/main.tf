terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

resource "databricks_volume" "this" {
  provider     = databricks.workspace
  catalog_name = var.catalog_name
  schema_name  = var.schema_name
  name         = var.volume_name
  volume_type  = "MANAGED"
  comment      = var.comment
}

resource "databricks_grant" "volume" {
  provider = databricks.workspace
  for_each = var.grants

  volume     = databricks_volume.this.id
  principal  = each.value.principal
  privileges = each.value.privileges
}
