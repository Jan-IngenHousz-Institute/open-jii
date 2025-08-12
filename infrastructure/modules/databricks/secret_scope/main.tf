terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

# Create a secret scope
resource "databricks_secret_scope" "this" {
  provider = databricks.workspace
  name     = var.scope_name

  backend_type = "DATABRICKS"
}

# Add secrets to the scope
resource "databricks_secret" "secret" {
  count = length(keys(var.secrets))

  provider     = databricks.workspace
  key          = keys(var.secrets)[count.index]
  string_value = values(var.secrets)[count.index]
  scope        = databricks_secret_scope.this.name
}

# Create ACL permissions for the scope (users, groups, and service principals)
resource "databricks_secret_acl" "acls" {
  count = length(var.acl_principals)

  provider   = databricks.workspace
  principal  = var.acl_principals[count.index]
  permission = var.acl_permissions[count.index]
  scope      = databricks_secret_scope.this.name
}
