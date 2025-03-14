terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# Find smallest available node type
data "databricks_node_type" "smallest" {
  local_disk = true
  provider   = databricks.workspace
}

# Find latest Spark version
data "databricks_spark_version" "latest_lts" {
  long_term_support = true
  provider          = databricks.workspace
}

resource "databricks_cluster" "this" {
  provider                = databricks.workspace
  cluster_name            = var.name
  spark_version           = var.spark_version != null ? var.spark_version : data.databricks_spark_version.latest_lts.id
  node_type_id            = var.node_type_id != null ? var.node_type_id : data.databricks_node_type.smallest.id
  autotermination_minutes = var.autotermination_minutes
  data_security_mode      = var.single_user ? "SINGLE_USER" : null
  single_user_name        = var.single_user ? var.single_user_name : null
  is_single_node          = var.single_node
  kind                    = "CLASSIC_PREVIEW"
}
