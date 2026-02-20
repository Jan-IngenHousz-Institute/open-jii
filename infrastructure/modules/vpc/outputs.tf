output "vpc_id" {
  description = "The VPC ID"
  value       = aws_vpc.this.id
}

output "public_subnets" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnets" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "isolated_subnets" {
  description = "IDs of isolated subnets"
  value       = aws_subnet.isolated[*].id
}

output "public_rt_ids" {
  description = "Public route table IDs"
  value       = aws_route_table.public[*].id
}

output "private_rt_ids" {
  description = "Private route table IDs"
  value       = aws_route_table.private[*].id
}

output "isolated_rt_ids" {
  description = "Isolated route table IDs (single table shared by all isolated subnets)"
  value       = [aws_route_table.isolated.id]
}

output "default_sg_id" {
  description = "Default security group ID"
  value       = aws_security_group.default.id
}

output "db_subnet_group_name" {
  value = var.create_aurora_resources ? aws_db_subnet_group.aurora_subnet_group[0].name : null
}

output "aurora_security_group_id" {
  value = var.create_aurora_resources ? aws_security_group.aurora_sg[0].id : null
}

output "migration_task_security_group_id" {
  description = "ID of the security group for migration tasks"
  value       = var.create_migration_resources ? aws_security_group.migration_task_sg[0].id : null
}

output "server_lambda_security_group_id" {
  description = "ID of the security group for the server Lambda function to access Aurora (if enabled)"
  value       = var.create_lambda_resources ? aws_security_group.server_lambda_aurora[0].id : null
}

output "alb_security_group_id" {
  description = "ID of the Application Load Balancer security group"
  value       = var.create_alb_resources ? aws_security_group.alb_sg[0].id : null
}

output "ecs_security_group_id" {
  description = "ID of the ECS task security group"
  value       = var.create_ecs_resources ? aws_security_group.ecs_sg[0].id : null
}

output "macro_runner_lambda_security_group_id" {
  description = "ID of the macro-runner Lambda security group (isolated, no inbound, HTTPS to VPC endpoints only)"
  value       = var.create_macro_runner_resources ? aws_security_group.macro_runner_lambda[0].id : null
}
