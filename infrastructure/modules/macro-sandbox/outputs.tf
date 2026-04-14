output "function_names" {
  description = "Lambda function names keyed by language"
  value       = module.lambda.function_names
}

output "invoke_policy_arn" {
  description = "IAM policy ARN granting lambda:InvokeFunction on macro-sandbox functions — attach to backend task role"
  value       = module.lambda.invoke_policy_arn
}
