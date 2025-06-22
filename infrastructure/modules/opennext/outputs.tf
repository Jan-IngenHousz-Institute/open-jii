# CloudFront Distribution Outputs
output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = module.cloudfront.distribution_id
}

output "cloudfront_distribution_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = module.cloudfront.distribution_domain_name
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = module.cloudfront.distribution_arn
}

output "cloudfront_hosted_zone_id" {
  description = "Hosted zone ID of the CloudFront distribution"
  value       = module.cloudfront.distribution_hosted_zone_id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution (alias for cloudfront_distribution_domain_name)"
  value       = module.cloudfront.distribution_domain_name
}

# S3 Bucket Outputs
output "assets_bucket_name" {
  description = "Name of the S3 assets bucket"
  value       = aws_s3_bucket.assets.bucket
}

output "assets_bucket_arn" {
  description = "ARN of the S3 assets bucket"
  value       = aws_s3_bucket.assets.arn
}

output "cache_bucket_name" {
  description = "Name of the S3 cache bucket"
  value       = aws_s3_bucket.cache.bucket
}

output "cache_bucket_arn" {
  description = "ARN of the S3 cache bucket"
  value       = aws_s3_bucket.cache.arn
}

# Lambda Function Outputs
output "server_function_name" {
  description = "Name of the server Lambda function"
  value       = module.server_function.function_name
}

output "server_function_arn" {
  description = "ARN of the server Lambda function"
  value       = module.server_function.function_arn
}

output "server_function_url" {
  description = "Function URL of the server Lambda"
  value       = module.server_function.function_url
}

output "image_function_name" {
  description = "Name of the image optimization Lambda function"
  value       = module.image_function.function_name
}

output "image_function_arn" {
  description = "ARN of the image optimization Lambda function"
  value       = module.image_function.function_arn
}

output "image_function_url" {
  description = "Function URL of the image optimization Lambda"
  value       = module.image_function.function_url
}

output "revalidation_function_name" {
  description = "Name of the revalidation Lambda function"
  value       = module.revalidate_function.function_name
}

output "revalidation_function_arn" {
  description = "ARN of the revalidation Lambda function"
  value       = module.revalidate_function.function_arn
}

output "warmer_function_name" {
  description = "Name of the warmer Lambda function (if enabled)"
  value       = var.enable_lambda_warming ? module.warmer_function[0].function_name : null
}

output "warmer_function_arn" {
  description = "ARN of the warmer Lambda function (if enabled)"
  value       = var.enable_lambda_warming ? module.warmer_function[0].function_arn : null
}

# DynamoDB Outputs
output "dynamodb_table_name" {
  description = "Name of the DynamoDB revalidation table"
  value       = module.dynamodb.table_name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB revalidation table"
  value       = module.dynamodb.table_arn
}

# SQS Outputs
output "sqs_queue_url" {
  description = "URL of the SQS revalidation queue"
  value       = module.sqs.queue_url
}

output "sqs_queue_arn" {
  description = "ARN of the SQS revalidation queue"
  value       = module.sqs.queue_arn
}

output "sqs_dlq_url" {
  description = "URL of the SQS dead letter queue (if enabled)"
  value       = module.sqs.dlq_url
}

# Domain and URL Outputs
output "application_url" {
  description = "URL to access the application"
  value       = local.domain_name != "" ? "https://${local.domain_name}" : "https://${module.cloudfront.distribution_domain_name}"
}

output "custom_domain" {
  description = "Custom domain name (if configured)"
  value       = local.domain_name != "" ? local.domain_name : null
}

# Deployment Information
output "deployment_region" {
  description = "AWS region where resources are deployed"
  value       = var.region
}

output "deployment_environment" {
  description = "Environment name for this deployment"
  value       = var.environment
}

# IAM Role ARNs (useful for CI/CD)
output "server_function_role_arn" {
  description = "ARN of the server Lambda function's IAM role"
  value       = module.server_function.role_arn
}

output "image_function_role_arn" {
  description = "ARN of the image optimization Lambda function's IAM role"
  value       = module.image_function.role_arn
}

output "revalidation_function_role_arn" {
  description = "ARN of the revalidation Lambda function's IAM role"
  value       = module.revalidate_function.role_arn
}
