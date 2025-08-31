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

variable "acl_principals" {
  description = "List of principals (user, group, or service principal) for ACLs"
  type        = list(string)
  default     = []
}

variable "acl_permissions" {
  description = "List of permissions (READ, WRITE, MANAGE) for ACLs, corresponding to acl_principals"
  type        = list(string)
  default     = []
  validation {
    condition = alltrue([
      for permission in var.acl_permissions : contains(["READ", "WRITE", "MANAGE"], permission)
    ])
    error_message = "Permissions must be one of READ, WRITE, or MANAGE"
  }
}
