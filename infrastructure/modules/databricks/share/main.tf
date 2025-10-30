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

  # Add initial schemas to the share (if any provided)
  # Additional schemas can be added programmatically via Databricks SDK
  dynamic "object" {
    for_each = var.schemas
    content {
      name             = "${var.catalog_name}.${object.value.name}"
      data_object_type = "SCHEMA"
      comment          = lookup(object.value, "comment", null)
    }
  }
  
  # Lifecycle: ignore changes to objects since they're managed dynamically
  lifecycle {
    ignore_changes = [
      object  # Python code will add experiment schemas dynamically
    ]
  }
}
