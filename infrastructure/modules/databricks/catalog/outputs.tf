output "catalog_id" {
  description = "The unique identifier of the created Databricks catalog. This can be referenced in other resources."
  value       = databricks_catalog.this.id
}

output "catalog_name" {
  description = "The name of the created Databricks catalog."
  value       = databricks_catalog.this.name
}
