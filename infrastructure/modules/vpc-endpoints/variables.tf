variable "aws_region" {
  description = "AWS region for infrastructure deployment"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, production)"
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

# Feature toggles for VPC endpoints
variable "create_s3_endpoint" {
  description = "Whether to create S3 VPC endpoint (Gateway type)"
  type        = bool
  default     = true
}

variable "create_sts_endpoint" {
  description = "Whether to create STS VPC endpoint (Interface type)"
  type        = bool
  default     = true
}

variable "create_kinesis_endpoint" {
  description = "Whether to create Kinesis Streams VPC endpoint (Interface type)"
  type        = bool
  default     = true
}

# ---- Macro-runner Lambda endpoints ----

variable "isolated_route_table_ids" {
  description = "List of isolated route table IDs (for S3 gateway — needed by Lambda image pulls)"
  type        = list(string)
  default     = []
}

variable "isolated_subnet_ids" {
  description = "List of isolated subnet IDs (for interface endpoints used by Lambda)"
  type        = list(string)
  default     = []
}

variable "create_ecr_api_endpoint" {
  description = "Whether to create ECR API VPC endpoint (Interface type — required for Lambda in isolated subnets)"
  type        = bool
  default     = false
}

variable "create_ecr_dkr_endpoint" {
  description = "Whether to create ECR Docker VPC endpoint (Interface type — required for Lambda image pulls)"
  type        = bool
  default     = false
}

variable "create_logs_endpoint" {
  description = "Whether to create CloudWatch Logs VPC endpoint (Interface type — required for Lambda logging)"
  type        = bool
  default     = false
}
