terraform {
  required_providers {
    databricks = {
      source                = "databricks/databricks"
      version               = ">= 1.13.0"
      configuration_aliases = [databricks.workspace]
    }
  }
}

resource "databricks_service_principal" "this" {
  provider     = databricks.workspace
  display_name = var.display_name
  active       = var.active
}

resource "databricks_service_principal_secret" "this" {
  count                = var.create_secret ? 1 : 0
  provider             = databricks.workspace
  service_principal_id = databricks_service_principal.this.id
}

data "databricks_group" "this" {
  for_each     = toset(var.group_names)
  provider     = databricks.workspace
  display_name = each.value
}

# Add service principal to group if specified
resource "databricks_group_member" "this" {
  for_each  = toset(var.group_names)
  provider  = databricks.workspace
  group_id  = data.databricks_group.this[each.value].id
  member_id = databricks_service_principal.this.id
}
