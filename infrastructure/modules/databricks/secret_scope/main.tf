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
resource "databricks_secret" "secrets" {
  for_each = var.secrets

  provider     = databricks.workspace
  key          = each.key
  string_value = each.value
  scope        = databricks_secret_scope.this.name
}

# Create ACL permissions for the scope (users, groups, and service principals)
resource "databricks_secret_acl" "acls" {
  for_each = var.acls

  provider   = databricks.workspace
  principal  = each.key
  permission = each.value
  scope      = databricks_secret_scope.this.name
}
