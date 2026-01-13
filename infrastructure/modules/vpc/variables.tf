variable "tags" {
  description = "A map of tags to add to all resources"
  type        = map(string)
  default     = {}
}

variable "cidr_block" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of Availability Zones to use"
  type        = number
  default     = 2
}

variable "nat_gateway_count" {
  description = "Number of NAT Gateways to create (1 for single NAT gateway, or az_count for high availability)"
  type        = number
  default     = null # defaults to az_count if not specified
}

variable "subnet_bits" {
  description = "Number of extra bits to use when carving out subnets (e.g., /16 -> /24)"
  type        = number
  default     = 8
}

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, production)"
  type        = string
  default     = "dev"
}

variable "container_port" {
  description = "Default container port for ECS tasks"
  type        = number
  default     = 3020
}

# Feature toggles
variable "create_aurora_resources" {
  description = "Whether to create Aurora DB security group and related resources"
  type        = bool
  default     = true
}

variable "create_alb_resources" {
  description = "Whether to create ALB security group"
  type        = bool
  default     = true
}

variable "create_ecs_resources" {
  description = "Whether to create ECS security group"
  type        = bool
  default     = true
}

variable "create_migration_resources" {
  description = "Whether to create migration task security group"
  type        = bool
  default     = true
}

variable "create_lambda_resources" {
  description = "Whether to create Lambda (OpenNext server) security group"
  type        = bool
  default     = true
}
