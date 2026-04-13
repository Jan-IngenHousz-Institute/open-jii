output "log_group_name" {
  description = "CloudWatch log group name for flow logs"
  value       = aws_cloudwatch_log_group.this.name
}

output "log_group_arn" {
  description = "CloudWatch log group ARN for flow logs"
  value       = aws_cloudwatch_log_group.this.arn
}

output "iam_role_arn" {
  description = "IAM role ARN used by VPC flow logs"
  value       = aws_iam_role.this.arn
}
