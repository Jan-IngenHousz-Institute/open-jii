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

output "secret_keys" {
  description = "Map of secret names to their keys, allowing access like secret_keys[\"key_name\"]"
  value       = { for k, v in var.secrets : k => k }
  sensitive   = false
}
