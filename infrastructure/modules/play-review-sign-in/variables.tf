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

variable "tags" {
  description = "Tags for the secret"
  type        = map(string)
  default     = {}
}
