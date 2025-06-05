# OpenNext Infrastructure Outputs
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

output "opennext_cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution for the Next.js app"
  value       = module.opennext.cloudfront_distribution_id
}

output "opennext_dynamodb_table_name" {
  description = "Name of the DynamoDB table for Next.js cache/revalidation"
  value       = module.opennext.dynamodb_table_name
}

# Database Infrastructure Outputs
output "database_endpoint" {
  description = "Aurora cluster primary endpoint for write operations"
  value       = module.aurora_db.cluster_endpoint
}

output "database_reader_endpoint" {
  description = "Aurora cluster reader endpoint for read-only operations"
  value       = module.aurora_db.reader_endpoint
}

output "database_port" {
  description = "Aurora cluster port number"
  value       = module.aurora_db.cluster_port
}

output "database_name" {
  description = "Name of the default database"
  value       = module.aurora_db.database_name
}

output "database_secret_arn" {
  description = "Secret ARN used by AWS Secrets Manager for the master credentials"
  value       = module.aurora_db.master_user_secret_arn
  sensitive   = true
}

# Database Migration Infrastructure Outputs
output "migration_runner_ecr_repository_name" {
  description = "ECR repository name for database migrations Docker images"
  value       = module.migration_runner_ecr.repository_name
}

output "migration_runner_ecs_cluster_name" {
  description = "ECS cluster name for running database migrations"
  value       = module.migration_runner_ecs.ecs_cluster_name
}

output "migration_runner_task_definition_family" {
  description = "Task definition family for database migrations"
  value       = module.migration_runner_ecs.ecs_task_deifiniton_family
}

output "migration_runner_container_name" {
  description = "Name of the primary container in the ECS task definition for migrations"
  value       = module.migration_runner_ecs.container_name
  sensitive   = true
}

output "migration_runner_subnets" {
  description = "Subnet IDs for the database migration task"
  value       = jsonencode(module.vpc.private_subnets)
  sensitive   = true
}

output "migration_runner_security_group_id" {
  description = "Security group ID for the database migration task"
  value       = module.vpc.migration_task_security_group_id
  sensitive   = true
}
