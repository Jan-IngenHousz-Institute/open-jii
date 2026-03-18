output "schema_id" {
  description = "The ID of the created schema"
  value       = databricks_schema.this.id
}

output "schema_name" {
  description = "The name of the created schema"
  value       = databricks_schema.this.name
}
