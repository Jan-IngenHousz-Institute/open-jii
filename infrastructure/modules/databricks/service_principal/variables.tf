variable "display_name" {
  description = "Display name for the service principal"
  type        = string
}

variable "active" {
  description = "Whether the service principal is active"
  type        = bool
  default     = true
}

variable "group_names" {
  description = "List of group names to add the service principal to"
  type        = list(string)
  default     = []
}

variable "create_secret" {
  description = "Whether to create a secret for the service principal."
  type        = bool
  default     = false
}
