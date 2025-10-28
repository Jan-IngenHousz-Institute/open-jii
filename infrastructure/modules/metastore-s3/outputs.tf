output "bucket_name" {
  description = "Name of the created S3 bucket for Unity Catalog"
  value       = aws_s3_bucket.external.id
}

output "bucket_arn" {
  description = "ARN of the created S3 bucket"
  value       = aws_s3_bucket.external.arn
}

output "iam_policy_arn" {
  description = "ARN of the IAM policy template for Unity Catalog access"
  value       = aws_iam_policy.external_data_access.arn
}

output "iam_policy_name" {
  description = "Name of the IAM policy template for Unity Catalog access"
  value       = aws_iam_policy.external_data_access.name
}

output "iam_role_name_template" {
  description = "Template name for IAM roles that will use this bucket"
  value       = local.uc_iam_role
}
