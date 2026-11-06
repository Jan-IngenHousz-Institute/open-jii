variable "enabled" {
  description = "Whether the backend gives the review address its fixed sign-in code"
  type        = bool
}

variable "environment" {
  description = "Environment name, used in the secret's name"
  type        = string
}

variable "log_group_name" {
  description = "The backend's log group, where failed review sign-ins are counted"
  type        = string
}

variable "domain_name" {
  description = "Domain of the generated review address"
  type        = string
}

variable "email_generation" {
  description = "Bump to replace the review address, which means a new review account"
  type        = number
  default     = 1
}

variable "otp_generation" {
  description = "Bump to rotate the review sign-in code"
  type        = number
  default     = 1
}

variable "tags" {
  description = "Tags for the secret"
  type        = map(string)
  default     = {}
}
