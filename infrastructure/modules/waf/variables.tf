variable "service_name" {
  description = "Base name for the service"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "rate_limit" {
  description = "Rate limit for requests per 5-minute period from a single IP"
  type        = number
  default     = 500
}

variable "blocked_countries" {
  description = "List of country codes to block (ISO 3166-1 alpha-2)"
  type        = list(string)
  default     = []
}

variable "log_retention_days" {
  description = "Number of days to retain WAF logs"
  type        = number
  default     = 30
}

variable "tags" {
  description = "A map of tags to assign to resources"
  type        = map(string)
  default     = {}
}

variable "large_body_bypass_routes" {
  description = "List of route configurations that should bypass the SizeRestrictions_BODY rule from AWSManagedRulesCommonRuleSet"
  type = list(object({
    search_string         = string
    positional_constraint = string
    method                = string
  }))
  default = []

  validation {
    condition = alltrue([
      for route in var.large_body_bypass_routes : contains([
        "EXACTLY", "STARTS_WITH", "ENDS_WITH", "CONTAINS", "CONTAINS_WORD"
      ], route.positional_constraint)
    ])
    error_message = "positional_constraint must be one of: EXACTLY, STARTS_WITH, ENDS_WITH, CONTAINS, CONTAINS_WORD"
  }

  validation {
    condition = alltrue([
      for route in var.large_body_bypass_routes : contains([
        "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"
      ], route.method)
    ])
    error_message = "method must be one of: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS"
  }
}

variable "enable_bot_control" {
  description = "Enable AWS Managed Bot Control rule set. Adds ~$10/month + $1/million requests."
  type        = bool
  default     = false
}

variable "bot_control_inspection_level" {
  description = "Inspection level for Bot Control rule set. COMMON detects common bots, TARGETED adds advanced detection for targeted bots."
  type        = string
  default     = "COMMON"

  validation {
    condition     = contains(["COMMON", "TARGETED"], var.bot_control_inspection_level)
    error_message = "bot_control_inspection_level must be either COMMON or TARGETED."
  }
}

variable "large_body_max_size" {
  description = "Maximum body size in bytes allowed for large body bypass routes (default: 128KB = 131072 bytes)"
  type        = number
  default     = 131072 # 128KB

  validation {
    condition     = var.large_body_max_size > 8192
    error_message = "large_body_max_size must be greater than 8192 bytes (8KB)."
  }

  validation {
    condition     = var.large_body_max_size <= 21474836480
    error_message = "large_body_max_size must be less than or equal to 20GB (21474836480 bytes) due to CloudFront limits."
  }
}
