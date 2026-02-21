output "function_names" {
  description = "Lambda function names for macro execution"
  value       = { for k, fn in aws_lambda_function.this : k => fn.function_name }
}

output "invoke_policy_arn" {
  description = "IAM policy ARN granting lambda:InvokeFunction on all macro-runner functions — attach to backend task role"
  value       = aws_iam_policy.invoke.arn
}
