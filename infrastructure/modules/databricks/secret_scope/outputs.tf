output "scope_name" {
  description = "The name of the created secret scope"
  value       = databricks_secret_scope.this.name
}

output "scope_id" {
  description = "The ID of the created secret scope"
  value       = databricks_secret_scope.this.id
}

output "scope_backend_type" {
  description = "The backend type of the created secret scope"
  value       = databricks_secret_scope.this.backend_type
}
