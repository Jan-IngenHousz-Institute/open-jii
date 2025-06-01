# OpenNext Infrastructure Outputs
output "opennext_cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution for the Next.js app"
  value       = module.opennext.cloudfront_distribution_id
}
output "opennext_cloudfront_distribution_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = module.opennext.cloudfront_distribution_domain_name
}

output "opennext_assets_bucket_name" {
  description = "Name of the S3 bucket storing static assets"
  value       = module.opennext.assets_bucket_name
}

output "opennext_cache_bucket_name" {
  description = "Name of the S3 bucket storing cache data"
  value       = module.opennext.cache_bucket_name
}

output "opennext_server_function_name" {
  description = "Name of the server Lambda function"
  value       = module.opennext.server_function_name
}

output "opennext_image_function_name" {
  description = "Name of the image optimization Lambda function"
  value       = module.opennext.image_function_name
}

output "opennext_revalidation_function_name" {
  description = "Name of the revalidation Lambda function"
  value       = module.opennext.revalidation_function_name
}

output "opennext_warmer_function_name" {
  description = "Name of the warmer Lambda function (if enabled)"
  value       = module.opennext.warmer_function_name
}

output "opennext_application_url" {
  description = "URL to access the Next.js application"
  value       = module.opennext.application_url
}

output "opennext_custom_domain" {
  description = "Custom domain name (if configured)"
  value       = module.opennext.custom_domain
}

# DynamoDB outputs for monitoring/debugging
output "opennext_dynamodb_table_name" {
  description = "Name of the DynamoDB table for ISR"
  value       = module.opennext.dynamodb_table_name
}
