terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

resource "databricks_grants" "this" {
  provider = databricks.workspace
  schema   = "${var.catalog_name}.${var.schema_name}"

  dynamic "grant" {
    for_each = var.grants
    content {
      principal  = grant.value.principal
      privileges = grant.value.privileges
    }
  }
}
