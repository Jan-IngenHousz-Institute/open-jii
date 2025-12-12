variable "parameters" {
  description = "Map of SSM parameters to create. Each key is a unique identifier, and value is an object with 'name', 'value', and optional 'description', 'type', 'tier', and 'tags'"
  type = map(object({
    name        = string
    value       = string
    description = optional(string, "")
    type        = optional(string, "String")
    tier        = optional(string, "Standard")
    tags        = optional(map(string), {})
  }))

  validation {
    condition = alltrue([
      for k, v in var.parameters : contains(["String", "StringList", "SecureString"], v.type)
    ])
    error_message = "All parameter types must be String, StringList, or SecureString"
  }

  validation {
    condition = alltrue([
      for k, v in var.parameters : contains(["Standard", "Advanced"], v.tier)
    ])
    error_message = "All parameter tiers must be Standard or Advanced"
  }
}

variable "tags" {
  description = "Tags to apply to the resource"
  type        = map(string)
  default     = {}
}
