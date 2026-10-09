terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

resource "databricks_sql_endpoint" "this" {
  provider                  = databricks.workspace
  name                      = var.name
  cluster_size              = var.cluster_size
  min_num_clusters          = 1
  max_num_clusters          = var.max_num_clusters
  auto_stop_mins            = var.auto_stop_mins
  enable_serverless_compute = true
  warehouse_type            = "PRO"
}

# Authoritative over the warehouse's access list, so only for warehouses this module created.
resource "databricks_permissions" "this" {
  provider = databricks.workspace
  count    = length(var.can_use_groups) > 0 ? 1 : 0

  sql_endpoint_id = databricks_sql_endpoint.this.id

  dynamic "access_control" {
    for_each = var.can_use_groups
    content {
      group_name       = access_control.value
      permission_level = "CAN_USE"
    }
  }
}
