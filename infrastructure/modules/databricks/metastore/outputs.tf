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
