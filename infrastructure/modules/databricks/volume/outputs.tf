output "volume_id" {
  description = "The ID of the created Databricks volume"
  value       = databricks_volume.this.id
}

output "volume_name" {
  description = "The name of the created volume"
  value       = databricks_volume.this.name
}

output "volume_path" {
  description = "The fully qualified volume path in /Volumes format"
  value       = "/Volumes/${var.catalog_name}/${var.schema_name}/${var.volume_name}"
}
