variable "scope_name" {
  description = "Name of the secret scope"
  type        = string
}

variable "secrets" {
  description = "Values OpenTofu writes into the scope, by key. Credentials are set with `pnpm secrets:set`; the Slack webhook is the one exception, kept in OpenTofu as rotate-a-secret.md explains"
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
