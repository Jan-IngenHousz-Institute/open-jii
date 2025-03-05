output "metastore_id" {
  description = "ID of the created Unity Catalog metastore"
  value       = databricks_metastore.this.id
}

output "metastore_name" {
  description = "Name of the created Unity Catalog metastore"
  value       = databricks_metastore.this.name
}

output "metastore_assignments" {
  description = "The workspace assignments for this metastore"
  value       = { for k, v in databricks_metastore_assignment.default_metastore : k => v.workspace_id }
}

output "default_catalog_id" {
  description = "ID of the default catalog if created"
  value       = var.create_default_catalog ? databricks_catalog.default[0].id : null
}

output "storage_credential_association_id" {
  description = "ID of the storage credential association if created"
  value       = var.storage_credential_id != null ? databricks_metastore_data_access.this[0].id : null
}
