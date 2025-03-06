output "schema_id" {
  description = "The ID of the created Databricks experiment schema."
  value       = databricks_schema.experiment.id
}

output "schema_name" {
  description = "The name of the experiment schema."
  value       = databricks_schema.experiment.name
}

output "catalog_schema" {
  description = "The fully qualified name of the schema in format catalog_name.schema_name"
  value       = "${var.catalog_name}.${var.schema_name}"
}

output "experiment_metadata_table_id" {
  description = "The ID of the experiment metadata table (if created)."
  value       = var.create_metadata_tables ? databricks_sql_table.experiment_metadata[0].id : null
}
