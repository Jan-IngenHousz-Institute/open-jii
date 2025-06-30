output "service_principal_id" {
  description = "ID of the service principal"
  value       = databricks_service_principal.this.id
}

output "service_principal_application_id" {
  description = "Application ID of the service principal"
  value       = databricks_service_principal.this.application_id
}

output "service_principal_secret_value" {
  description = "The generated secret value for the service principal (if created)."
  value       = try(databricks_service_principal_secret.this[0].value, null)
  sensitive   = true
}
