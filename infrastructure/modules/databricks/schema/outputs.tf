output "schema_id" {
  description = "The ID of the created Databricks schema."
  value       = databricks_schema.this.id
}

output "schema_full_name" {
  description = "The fully qualified name of the schema."
  value       = databricks_schema.this.full_name
}

output "experiments_table_id" {
  description = "The ID of the experiments table."
  value       = databricks_sql_table.experiments.id
}
