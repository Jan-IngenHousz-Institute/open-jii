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

# The values OpenTofu may hold. Credentials go into the scope with `pnpm secrets:set`, so they
# reach no plan and no state.
resource "databricks_secret" "value" {
  for_each = toset(nonsensitive(keys(var.secrets)))

  provider     = databricks.workspace
  key          = each.key
  string_value = var.secrets[each.key]
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
