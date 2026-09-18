output "function_name" {
  description = "Lambda function name that computes calibration coefficients"
  value       = aws_lambda_function.this.function_name
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.this.arn
}

output "invoke_policy_arn" {
  description = "IAM policy ARN granting lambda:InvokeFunction on the calibration-sandbox function, attached to the backend task role"
  value       = aws_iam_policy.invoke.arn
}
