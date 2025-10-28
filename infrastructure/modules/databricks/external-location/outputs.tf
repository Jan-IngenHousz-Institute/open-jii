output "external_location_id" {
  description = "ID of the created external location"
  value       = databricks_external_location.this.id
}

output "external_location_name" {
  description = "Name of the created external location"
  value       = databricks_external_location.this.name
}

output "external_location_url" {
  description = "URL of the created external location"
  value       = databricks_external_location.this.url
}