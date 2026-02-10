variable "name" {
  description = "The name of the cluster policy"
  type        = string
}

variable "definition" {
  description = "JSON document expressed in Databricks Policy Definition Language. Cannot be used with policy_family_id"
  type        = string
  default     = null
}

variable "description" {
  description = "Additional description for the cluster policy"
  type        = string
  default     = null
}

variable "policy_family_id" {
  description = "ID of the policy family. Cannot be used with definition"
  type        = string
  default     = null
}

variable "policy_family_definition_overrides" {
  description = "JSON document with overrides to the policy family definition"
  type        = string
  default     = null
}

variable "max_clusters_per_user" {
  description = "Maximum number of clusters per user that can be created with this policy"
  type        = number
  default     = null
}

variable "libraries" {
  description = "List of libraries to be installed on every cluster created with this policy"
  type = list(object({
    jar = optional(string)
    egg = optional(string)
    whl = optional(string)
    pypi = optional(object({
      package = string
      repo    = optional(string)
    }))
    maven = optional(object({
      coordinates = string
      repo        = optional(string)
      exclusions  = optional(list(string))
    }))
    cran = optional(object({
      package = string
      repo    = optional(string)
    }))
  }))
  default = []
}

variable "permissions" {
  description = "List of permissions to grant on the cluster policy"
  type = list(object({
    user_name              = optional(string)
    group_name             = optional(string)
    service_principal_name = optional(string)
    permission_level       = string # CAN_USE or CAN_MANAGE
  }))
  default = []
}
