output "scope_name" {
  description = "The name of the created secret scope"
  value       = databricks_secret_scope.this.name
  sensitive   = true
}

output "scope_id" {
  description = "The ID of the created secret scope"
  value       = databricks_secret_scope.this.id
  sensitive   = true
}
