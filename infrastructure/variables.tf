variable "environment" {
  type        = string
  description = "Environment name"
  default = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "eu-central-1"
}
