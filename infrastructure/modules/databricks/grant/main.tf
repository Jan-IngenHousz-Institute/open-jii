terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# Grant recipient access to a share
resource "databricks_grants" "this" {
  provider = databricks.workspace
  share    = var.share_name

  grant {
    principal  = var.recipient_name
    privileges = ["SELECT"]
  }
}
