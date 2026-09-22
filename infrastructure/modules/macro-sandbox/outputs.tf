output "function_names" {
  description = "Lambda function names keyed by language"
  value       = module.lambda.function_names
}

output "invoke_policy_arn" {
  description = "IAM policy ARN granting lambda:InvokeFunction on macro-sandbox functions — attach to backend task role"
  value       = module.lambda.invoke_policy_arn
}

output "flow_log_group_name" {
  description = "Flow log group for the isolated subnets, shared with every sandbox that runs in them"
  value       = module.flow_logs.log_group_name
}
