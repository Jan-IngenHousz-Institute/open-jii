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

variable "subnet_bits" {
  description = "Number of extra bits to use when carving out subnets (e.g., /16 -> /24)"
  type        = number
  default     = 8
}
