output "table_id" {
  description = "The ID of the created table in the form of <catalog_name>.<schema_name>.<name>."
  value       = databricks_sql_table.this.id
}

output "table_unique_id" {
  description = "The unique identifier of the table."
  value       = databricks_sql_table.this.table_id
}

output "table_name" {
  description = "The name of the created table."
  value       = databricks_sql_table.this.name
}

output "table_fully_qualified_name" {
  description = "The fully qualified name of the table in the form catalog.schema.table."
  value       = "${var.catalog_name}.${var.schema_name}.${var.name}"
}
