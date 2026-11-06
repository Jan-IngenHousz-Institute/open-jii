variable "aws_region" {
  description = "The AWS region for resources"
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "The environment name"
  type        = string
  default     = "prod"
}

variable "dr_region" {
  description = "The AWS region the s3 module's DR provider points at"
  type        = string
  default     = "eu-west-1"
}
