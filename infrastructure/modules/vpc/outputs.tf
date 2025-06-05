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

output "default_sg_id" {
  description = "Default security group ID"
  value       = aws_security_group.default.id
}

output "db_subnet_group_name" {
  value = aws_db_subnet_group.aurora_subnet_group.name
}

output "aurora_security_group_id" {
  value = aws_security_group.aurora_sg.id
}

output "migration_task_security_group_id" {
  description = "ID of the security group for migration tasks"
  value       = aws_security_group.migration_task_sg.id
}

output "server_lambda_security_group_id" {
  description = "ID of the security group for the server Lambda function to access Aurora (if enabled)"
  value       = aws_security_group.server_lambda_aurora.id
}
