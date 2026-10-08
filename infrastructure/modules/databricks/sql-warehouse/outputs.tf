output "warehouse_id" {
  description = "The ID of the SQL warehouse"
  value       = databricks_sql_endpoint.this.id
}
