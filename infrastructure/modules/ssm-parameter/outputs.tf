output "parameter_names" {
  description = "Map of parameter keys to their names"
  value       = { for k, v in aws_ssm_parameter.parameter : k => v.name }
}

output "parameter_arns" {
  description = "Map of parameter keys to their ARNs"
  value       = { for k, v in aws_ssm_parameter.parameter : k => v.arn }
}

output "parameters" {
  description = "Full map of created parameters"
  value       = aws_ssm_parameter.parameter
}
