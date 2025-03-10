terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.mws]
    }
  }
}

resource "databricks_metastore" "this" {
  provider = databricks.mws
  name     = var.metastore_name
  owner    = var.owner
  region   = var.region
}

resource "databricks_metastore_assignment" "default_metastore" {
  provider     = databricks.mws
  for_each     = toset(var.workspace_ids)
  workspace_id = each.key
  metastore_id = databricks_metastore.this.id
}

# resource "databricks_metastore_data_access" "this" {
#   provider     = databricks.mws
#   metastore_id = databricks_metastore.this.id
#   name         = "open_jii_metastore_storage_cred"

#   aws_iam_role {
#     role_arn = var.storage_credential_role_arn
#   }

#   is_default = true

#   depends_on = [databricks_metastore_assignment.default_metastore]
# }


