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

output "private_rt_id" {
  description = "Private route table ID"
  value       = aws_route_table.private.id
}

output "isolated_rt_id" {
  description = "Isolated route table ID"
  value       = aws_route_table.isolated.id
}

output "default_sg_id" {
  description = "Default security group ID"
  value       = aws_security_group.default.id
}
