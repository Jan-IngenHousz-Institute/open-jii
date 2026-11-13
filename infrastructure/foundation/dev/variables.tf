variable "aws_region" {
  description = "The AWS region for resources"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "The environment name"
  type        = string
  default     = "dev"
}
