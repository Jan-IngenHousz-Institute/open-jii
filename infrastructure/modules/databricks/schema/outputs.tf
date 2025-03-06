output "schema_id" {
  description = "The ID of the created Databricks schema."
  value       = databricks_schema.this.id
}

output "schema_name" {
  description = "The name of the schema."
  value       = databricks_schema.this.name
}

output "catalog_schema" {
  description = "The fully qualified name of the schema in format catalog_name.schema_name"
  value       = "${var.catalog_name}.${var.schema_name}"
}

output "experiments_table_id" {
  description = "The ID of the experiments table."
  value       = databricks_sql_table.experiments.id
}
