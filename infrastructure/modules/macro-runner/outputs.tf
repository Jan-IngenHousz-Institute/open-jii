# ============================================================
# Macro Runner — outputs
# ============================================================

# ---- Lambda ----

output "function_arns" {
  description = "Lambda function ARNs keyed by language — grant lambda:InvokeFunction to backend task role"
  value       = module.lambda.function_arns
}

output "function_names" {
  description = "Lambda function names keyed by language"
  value       = module.lambda.function_names
}

output "lambda_sg_id" {
  description = "Security group ID for macro-runner Lambda functions"
  value       = module.lambda.lambda_sg_id
}

output "lambda_role_arn" {
  description = "IAM role ARN used by macro-runner Lambda functions"
  value       = module.lambda.lambda_role_arn
}

output "invoke_policy_arn" {
  description = "IAM policy ARN granting lambda:InvokeFunction on macro-runner functions — attach to backend task role"
  value       = module.lambda.invoke_policy_arn
}

# ---- ECR ----

output "ecr_repository_urls" {
  description = "ECR repository URLs keyed by language"
  value = {
    python = module.ecr_python.repository_url
    js     = module.ecr_js.repository_url
    r      = module.ecr_r.repository_url
  }
}

output "ecr_repository_arns" {
  description = "ECR repository ARNs keyed by language"
  value = {
    python = module.ecr_python.repository_arn
    js     = module.ecr_js.repository_arn
    r      = module.ecr_r.repository_arn
  }
}

# ---- Flow Logs ----

output "flow_log_group_name" {
  description = "CloudWatch log group name for VPC flow logs"
  value       = module.flow_logs.log_group_name
}

output "flow_log_group_arn" {
  description = "CloudWatch log group ARN for VPC flow logs"
  value       = module.flow_logs.log_group_arn
}
