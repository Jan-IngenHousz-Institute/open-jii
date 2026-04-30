terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# Create a Delta Sharing share
resource "databricks_share" "this" {
  provider = databricks.workspace
  name     = var.share_name
  comment  = var.comment

  dynamic "object" {
    for_each = var.schemas
    content {
      name             = "${var.catalog_name}.${object.value.name}"
      data_object_type = "SCHEMA"
      comment          = lookup(object.value, "comment", null)
    }
  }
}
