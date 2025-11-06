output "ecs_cluster_arn" {
  description = "The ARN of the ECS cluster"
  value       = aws_ecs_cluster.ecs_cluster.arn
}

output "ecs_cluster_id" {
  description = "The ID of the ECS cluster"
  value       = aws_ecs_cluster.ecs_cluster.id
}

output "ecs_cluster_name" {
  description = "The name of the ECS cluster"
  value       = aws_ecs_cluster.ecs_cluster.name
}

output "ecs_execution_role_arn" {
  description = "The ARN of the ECS execution role"
  value       = aws_iam_role.ecs_execution_role.arn
}

output "ecs_task_role_arn" {
  description = "The ARN of the ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}

output "ecs_service_id" {
  description = "The ID of the ECS service"
  value       = var.create_ecs_service ? aws_ecs_service.app_service[0].id : null
}

output "ecs_service_name" {
  description = "The name of the ECS service"
  value       = var.create_ecs_service ? aws_ecs_service.app_service[0].name : null
}

output "ecs_task_definition_family" {
  description = "The family name of the ECS task definition"
  value       = aws_ecs_task_definition.app_task.family
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.ecs_logs.name
}

output "service_discovery_namespace_id" {
  description = "ID of the service discovery namespace (if enabled)"
  value       = var.enable_service_discovery && var.create_ecs_service ? aws_service_discovery_private_dns_namespace.this[0].id : null
}

output "container_name" {
  description = "Name of the primary container in the task definition"
  value       = jsondecode(aws_ecs_task_definition.app_task.container_definitions)[0].name
  sensitive   = true
}
