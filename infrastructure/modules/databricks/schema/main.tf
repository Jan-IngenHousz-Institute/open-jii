# Adopts a schema that was originally created by a DLT pipeline so it can be
# managed entirely through IaC.  The import block brings the pre-existing schema
# into Terraform state on first apply; subsequent runs manage it normally.

terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

import {
  to = databricks_schema.this
  id = "${var.catalog_name}.${var.schema_name}"
}

resource "databricks_schema" "this" {
  provider     = databricks.workspace
  catalog_name = var.catalog_name
  name         = var.schema_name
  comment      = var.comment
}

resource "databricks_grant" "schema" {
  provider = databricks.workspace
  for_each = var.grants

  schema     = databricks_schema.this.id
  principal  = each.value.principal
  privileges = each.value.privileges
}
