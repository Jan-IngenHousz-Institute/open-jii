output "function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.function.arn
}

output "function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.function.function_name
}

output "function_url" {
  description = "Lambda function URL (if created)"
  value       = var.create_function_url ? aws_lambda_function_url.function_url[0].function_url : null
}

output "function_url_domain" {
  description = "Domain of the Lambda function URL"
  value       = var.create_function_url ? regex("https://([^/]+)", aws_lambda_function_url.function_url[0].function_url)[0] : null
}

output "role_arn" {
  description = "ARN of the IAM role"
  value       = aws_iam_role.lambda_role.arn
}

output "role_name" {
  description = "Name of the IAM role"
  value       = aws_iam_role.lambda_role.name
}

output "invoke_arn" {
  description = "ARN to invoke the Lambda function"
  value       = aws_lambda_function.function.invoke_arn
}
