output "parameter_name" {
  description = "Name of the created SSM parameter"
  value       = aws_ssm_parameter.parameter.name
}

output "role_arn" {
  description = "ARN of the IAM role that can be assumed to read the parameter"
  value       = aws_iam_role.cross_account_reader.arn
}
