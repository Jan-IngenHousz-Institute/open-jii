output "parameter_name" {
  description = "Name of the created SSM parameter"
  value       = aws_ssm_parameter.parameter.name
}

output "parameter_arn" {
  description = "ARN of the created SSM parameter"
  value       = aws_ssm_parameter.parameter.arn
}
