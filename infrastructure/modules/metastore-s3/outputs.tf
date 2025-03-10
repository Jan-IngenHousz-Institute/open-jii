output "bucket_name" {
  description = "Name of the created S3 bucket for Unity Catalog"
  value       = aws_s3_bucket.external.id
}

output "bucket_arn" {
  description = "ARN of the created S3 bucket"
  value       = aws_s3_bucket.external.arn
}

output "iam_role_arn" {
  description = "ARN of the IAM role for Unity Catalog"
  value       = aws_iam_role.external_data_access.arn
}

output "iam_role_name" {
  description = "Name of the IAM role for Unity Catalog"
  value       = aws_iam_role.external_data_access.name
}

output "storage_credential_id" {
  description = "ID of the created storage credential in Unity Catalog"
  value       = databricks_storage_credential.external.id
}

output "storage_credential_name" {
  description = "The name of the storage credential in Unity Catalog"
  value       = databricks_storage_credential.external.name
}

output "external_id" {
  description = "The external ID for the IAM role trust relationship"
  value       = databricks_storage_credential.external.aws_iam_role[0].external_id
}
