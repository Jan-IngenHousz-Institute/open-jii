variable "scope_name" {
  description = "Name of the secret scope"
  type        = string
}

variable "secrets" {
  description = "Map of secrets to create in the scope. The key is the secret name and value is the secret value"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "acls" {
  description = "Map of ACLs to create for the scope. The key is the principal (user, group, or service principal) and the value is the permission (READ, WRITE, MANAGE)"
  type        = map(string)
  default     = {}
  validation {
    condition = alltrue([
      for permission in values(var.acls) : contains(["READ", "WRITE", "MANAGE"], permission)
    ])
    error_message = "Permissions must be one of READ, WRITE, or MANAGE"
  }
}
