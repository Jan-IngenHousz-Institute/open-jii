terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

resource "databricks_sql_table" "this" {
  provider     = databricks.workspace
  catalog_name = var.catalog_name
  schema_name  = var.schema_name
  name         = var.name
  table_type   = var.table_type
  comment      = var.comment
  properties   = length(var.properties) > 0 ? var.properties : null

  dynamic "column" {
    for_each = var.columns
    content {
      name     = column.value.name
      type     = column.value.type
      comment  = column.value.comment
      nullable = column.value.nullable
      identity = column.value.identity
    }
  }
}

resource "databricks_grant" "table" {
  provider = databricks.workspace
  for_each = var.grants

  table      = databricks_sql_table.this.id
  principal  = each.value.principal
  privileges = each.value.privileges
}
