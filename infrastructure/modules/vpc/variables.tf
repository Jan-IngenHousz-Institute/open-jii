variable "environment" {
  description = "Environment name for tagging and resource naming"
  type        = string
  default     = "dev"
}

variable "az_count" {
  description = "Number of Availability Zones to use"
  type        = number
  default     = 2
}

variable "cidr_block" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_bits" {
  description = "Number of extra bits to use when carving out subnets"
  type        = number
  default     = 8
}

variable "tags" {
  description = "A map of tags to assign to resources"
  type        = map(string)
  default     = {}
}

variable "container_port" {
  description = "Container port to allow traffic to in the ECS security group"
  type        = number
  default     = 3020
}

variable "nat_count" {
  description = "Number of NAT Gateways to create (for cost optimization, use 1 for dev, match az_count for prod)"
  type        = number
  default     = null # null means use environment-based logic
}
