variable "aws_region" {
  description = "AWS region — must match where the app infra (ECS, ALB, CloudFront) is deployed"
  type        = string
  default     = "eu-central-1"
}

variable "stack_name" {
  description = "CloudFormation stack name for the DLT main stack"
  type        = string
  default     = "distributed-load-testing-on-aws"
}

variable "admin_name" {
  description = "Username for the DLT web console admin (no spaces)"
  type        = string
  default     = "openjii-admin"
}

variable "admin_email" {
  description = "Email address that will receive the temporary login credentials for the DLT console"
  type        = string
  sensitive   = true
  default     = "blagoj@info.nl"
}

# -----------------------------------------------------------------------
# VPC config — leave existing_vpc_id empty to let DLT create its own VPC.
# Use a CIDR range that does NOT overlap with open-jii app VPC (10.0.x.x).
# -----------------------------------------------------------------------
variable "existing_vpc_id" {
  description = "Leave empty to have DLT create a dedicated VPC (recommended)"
  type        = string
  default     = ""
}

variable "existing_subnet_a" {
  description = "Only required when existing_vpc_id is set"
  type        = string
  default     = ""
}

variable "existing_subnet_b" {
  description = "Only required when existing_vpc_id is set"
  type        = string
  default     = ""
}

variable "vpc_cidr_block" {
  description = "CIDR for new DLT VPC — must not overlap with open-jii app VPC (10.0.0.0/16)"
  type        = string
  default     = "10.1.0.0/16"
}

variable "subnet_a_cidr_block" {
  description = "CIDR for DLT public subnet A"
  type        = string
  default     = "10.1.0.0/24"
}

variable "subnet_b_cidr_block" {
  description = "CIDR for DLT public subnet B"
  type        = string
  default     = "10.1.1.0/24"
}

variable "egress_cidr_block" {
  description = "Outbound CIDR for Fargate task containers — restrict if you only want to hit specific endpoints"
  type        = string
  default     = "0.0.0.0/0"
}

variable "use_stable_tagging" {
  description = "Yes = use vX.Y_stable container tag (safer); No = use exact version tag"
  type        = string
  default     = "Yes"

  validation {
    condition     = contains(["Yes", "No"], var.use_stable_tagging)
    error_message = "Must be 'Yes' or 'No'."
  }
}
