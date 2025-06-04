output "ecr_repository_url" {
  description = "URL of the ECR repository for migration container images"
  value       = aws_ecr_repository.migration_repository.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository for migration container images"
  value       = aws_ecr_repository.migration_repository.arn
}

output "task_definition_arn" {
  description = "ARN of the ECS task definition for migrations"
  value       = aws_ecs_task_definition.migration_task.arn
}

output "task_execution_role_arn" {
  description = "ARN of the execution role for the ECS task"
  value       = aws_iam_role.task_execution_role.arn
}

output "task_role_arn" {
  description = "ARN of the task role for the ECS task"
  value       = aws_iam_role.task_role.arn
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group for the ECS task"
  value       = aws_cloudwatch_log_group.migration_logs.arn
}

output "security_group_id" {
  description = "ID of the security group created for the ECS task"
  value       = aws_security_group.migration_task_sg.id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster to use for migrations"
  value       = local.ecs_cluster_name
}

output "task_definition_family" {
  description = "Family name of the task definition"
  value       = aws_ecs_task_definition.migration_task.family
}
