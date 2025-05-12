variable "region" {
  type        = string
  description = "AWS region"
  default     = "eu-west-1"
}

variable "identity_pool_name" {
  type        = string
  description = "Name for the Cognito Identity Pool"
}
