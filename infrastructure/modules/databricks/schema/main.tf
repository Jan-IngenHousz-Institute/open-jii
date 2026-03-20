# Adopts a schema that was originally created by a DLT pipeline so it can be
# managed entirely through IaC.
#
# NOTE: If this module is used for a pre-existing schema, you MUST import it
# into state manually before the first apply:
#
#   tofu import 'module.<MODULE_NAME>.databricks_schema.this' '<catalog_name>.<schema_name>'
#

terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
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
