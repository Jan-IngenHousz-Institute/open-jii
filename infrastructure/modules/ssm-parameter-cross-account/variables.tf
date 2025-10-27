variable "parameter_name" {
  description = "The name of the SSM parameter (e.g., /open-jii/route53/dev-nameservers)"
  type        = string
}

variable "parameter_name_prefix" {
  description = "Prefix for IAM resources derived from parameter name (e.g., open-jii-dev-nameservers)"
  type        = string
}

variable "description" {
  description = "Description of the SSM parameter"
  type        = string
  default     = ""
}

variable "parameter_type" {
  description = "Type of the parameter (String, StringList, or SecureString)"
  type        = string
  default     = "StringList"

  validation {
    condition     = contains(["String", "StringList", "SecureString"], var.parameter_type)
    error_message = "Parameter type must be String, StringList, or SecureString"
  }
}

variable "parameter_value" {
  description = "The value to store in the parameter"
  type        = string
}

variable "tier" {
  description = "The tier of the parameter (Standard or Advanced)"
  type        = string
  default     = "Standard"

  validation {
    condition     = contains(["Standard", "Advanced"], var.tier)
    error_message = "Tier must be Standard or Advanced"
  }
}

variable "trusted_principals" {
  description = "List of AWS principal ARNs (accounts, roles, or users) that can assume the role to read this parameter"
  type        = list(string)
}

variable "external_id" {
  description = "Optional external ID for additional security when assuming the role"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
