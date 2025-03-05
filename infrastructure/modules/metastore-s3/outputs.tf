output "bucket_name" {
  description = "The name of the S3 bucket"
  value       = aws_s3_bucket.metastore.bucket
}

output "bucket_arn" {
  description = "The ARN of the S3 bucket"
  value       = aws_s3_bucket.metastore.arn
}

output "iam_role_arn" {
  description = "The ARN of the IAM role for Unity Catalog access"
  value       = aws_iam_role.unity_catalog_access.arn
}

output "iam_role_name" {
  description = "The name of the IAM role for Unity Catalog access"
  value       = aws_iam_role.unity_catalog_access.name
}

output "storage_credential_id" {
  description = "The ID of the storage credential in Unity Catalog"
  value       = databricks_storage_credential.this.id
}

output "storage_credential_name" {
  description = "The name of the storage credential in Unity Catalog"
  value       = databricks_storage_credential.this.name
}

output "external_id" {
  description = "The external ID for the IAM role trust relationship"
  value       = databricks_storage_credential.this.aws_iam_role[0].external_id
}

output "external_location_id" {
  description = "The ID of the external location in Unity Catalog"
  value       = var.create_external_location ? databricks_external_location.this[0].id : null
}
