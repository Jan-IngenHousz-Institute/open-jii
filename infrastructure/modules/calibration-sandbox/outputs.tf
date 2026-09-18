output "function_name" {
  description = "Lambda function name, wired into the backend as AWS_LAMBDA_CALIBRATION_SANDBOX_FUNCTION_NAME"
  value       = module.lambda.function_name
}

output "invoke_policy_arn" {
  description = "IAM policy ARN granting lambda:InvokeFunction on the calibration-sandbox function, attached to the backend task role"
  value       = module.lambda.invoke_policy_arn
}

output "ecr_repository_url" {
  description = "ECR repository URL the deploy workflow pushes the image to"
  value       = module.ecr.repository_url
}
