variable "environment" {
  type        = string
  description = "Deployment environment (e.g., dev, staging, prod)"
}

variable "region" {
  type        = string
  description = "AWS region"
  default     = "eu-west-1"
}

variable "identity_pool_name" {
  type        = string
  description = "Name for the Cognito Identity Pool"
}

variable "developer_provider_name" {
  type        = string
  description = "Developer provider name for developer-authenticated identities (e.g., login.openjii.com)"
  default     = "login.openjii.com"
}

variable "allow_unauthenticated_identities" {
  type        = bool
  description = "Whether to allow unauthenticated identities"
}

variable "auth_role" {
  type        = bool
  description = "ARN of the IAM role for authenticated users"
}