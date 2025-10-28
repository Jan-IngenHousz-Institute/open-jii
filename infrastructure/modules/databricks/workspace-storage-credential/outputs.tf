output "storage_credential_id" {
  description = "ID of the created storage credential"
  value       = databricks_storage_credential.this.id
}

output "storage_credential_name" {
  description = "Name of the created storage credential"
  value       = databricks_storage_credential.this.name
}

output "iam_role_arn" {
  description = "ARN of the created IAM role"
  value       = aws_iam_role.storage_access.arn
}

output "iam_role_name" {
  description = "Name of the created IAM role"
  value       = aws_iam_role.storage_access.name
}