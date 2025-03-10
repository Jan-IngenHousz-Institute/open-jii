output "kinesis_stream_arn" {
  description = "The ARN of the Kinesis Data Stream"
  value       = aws_kinesis_stream.this.arn
}

output "kinesis_stream_name" {
  description = "The name of the Kinesis Data Stream"
  value       = aws_kinesis_stream.this.name
}

output "role_arn" {
  description = "ARN of the IAM role for Kinesis access"
  value       = aws_iam_role.unity_catalog_kinesis_role.arn
}

output "role_name" {
  description = "Name of the IAM role for Kinesis access"
  value       = aws_iam_role.unity_catalog_kinesis_role.name
}

output "policy_arn" {
  description = "ARN of the IAM policy for Kinesis access"
  value       = aws_iam_policy.kinesis_access_policy.arn
}
