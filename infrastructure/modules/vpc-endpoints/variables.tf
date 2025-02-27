variable "aws_region" {
  description = "AWS region for infrastructure deployment"
  type        = string
}

variable "vpc_id" {
  description = "The VPC ID in which to create the endpoints"
  type        = string
}

variable "private_route_table_ids" {
  description = "List of private route table IDs for the VPC (used for S3 endpoint)"
  type        = list(string)
}

variable "public_route_table_ids" {
  description = "List of public route table IDs for the VPC (used for S3 endpoint)"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs (used for interface endpoints)"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs to attach to interface endpoints (e.g., the default VPC SG)"
  type        = list(string)
}

