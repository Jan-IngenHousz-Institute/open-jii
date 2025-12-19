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

output "grant_ids" {
  description = "IDs of the grants created on the external location"
  value       = { for k, v in databricks_grants.this : k => v.id }
}