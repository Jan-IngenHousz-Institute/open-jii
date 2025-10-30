variable "recipient_name" {
  description = "The name of the recipient. Must be unique within the metastore. Use lowercase letters, numbers, and underscores."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9_]+$", var.recipient_name))
    error_message = "Recipient name must contain only lowercase letters, numbers, and underscores."
  }
}

variable "comment" {
  description = "Optional comment describing the recipient. Helps with documentation and governance."
  type        = string
  default     = null
}

variable "authentication_type" {
  description = "Authentication type for the recipient. Supported values: TOKEN (bearer token), DATABRICKS (OAuth)"
  type        = string
  default     = "TOKEN"

  validation {
    condition     = contains(["TOKEN", "DATABRICKS"], var.authentication_type)
    error_message = "Authentication type must be either TOKEN or DATABRICKS."
  }
}

variable "sharing_code" {
  description = "Optional sharing code for recipient activation. Used when creating a recipient that will self-activate."
  type        = string
  default     = null
  sensitive   = true
}

variable "allowed_ip_addresses" {
  description = "Optional list of IP addresses (CIDR notation) that are allowed to access the share. Empty list means no restrictions."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for ip in var.allowed_ip_addresses : can(cidrhost(ip, 0))
    ])
    error_message = "Each IP address must be in valid CIDR notation (e.g., '192.168.1.0/24' or '10.0.0.1/32')."
  }
}

variable "properties" {
  description = "Optional map of properties for the recipient. Used for metadata and custom attributes."
  type        = map(string)
  default     = {}
}
