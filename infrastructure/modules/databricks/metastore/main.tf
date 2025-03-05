terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.mws]
    }
  }
}

# Create Unity Catalog metastore
resource "databricks_metastore" "this" {
  provider      = databricks.mws
  name          = var.metastore_name
  owner         = var.owner
  region        = var.region
  storage_root  = "s3://${var.bucket_name}"
  force_destroy = var.force_destroy
}

# Assign the metastore to specified workspaces
resource "databricks_metastore_assignment" "default_metastore" {
  provider     = databricks.mws
  for_each     = toset(var.workspace_ids)
  workspace_id = each.key
  metastore_id = databricks_metastore.this.id
}

# Create default catalog if specified
resource "databricks_catalog" "default" {
  provider     = databricks.mws
  count        = var.create_default_catalog ? 1 : 0
  metastore_id = databricks_metastore.this.id
  name         = var.default_catalog_name
  comment      = "Default catalog created by Terraform"

  depends_on = [databricks_metastore_assignment.default_metastore]
}

# Associate storage credential with metastore
resource "databricks_metastore_data_access" "this" {
  provider     = databricks.mws
  count        = var.storage_credential_id != null ? 1 : 0
  metastore_id = databricks_metastore.this.id
  name         = "primary-storage-credential"
  aws_iam_role {
    role_arn = var.storage_credential_role_arn
  }
  is_default = true

  depends_on = [databricks_metastore_assignment.default_metastore]
}
