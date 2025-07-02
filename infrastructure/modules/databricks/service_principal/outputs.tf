output "service_principal_id" {
  description = "ID of the service principal"
  value       = databricks_service_principal.this.id
}

output "service_principal_application_id" {
  description = "Application ID of the service principal"
  value       = databricks_service_principal.this.application_id
}

output "service_principal_display_name" {
  description = "Display name of the service principal"
  value       = databricks_service_principal.this.display_name
}

output "service_principal_secret_value" {
  description = "Secret value of the service principal"
  value       = var.create_secret ? databricks_service_principal_secret.this[0].secret : null
  sensitive   = true
}

