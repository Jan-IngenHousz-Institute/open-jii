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
  default     = 2000
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

variable "restrictive_rate_limit_routes" {
  description = "List of route configurations that should have restrictive rate limiting applied"
  type = list(object({
    search_string         = string
    positional_constraint = string
    method               = string
  }))
  default = []

  validation {
    condition = alltrue([
      for route in var.restrictive_rate_limit_routes : contains([
        "EXACTLY", "STARTS_WITH", "ENDS_WITH", "CONTAINS", "CONTAINS_WORD"
      ], route.positional_constraint)
    ])
    error_message = "positional_constraint must be one of: EXACTLY, STARTS_WITH, ENDS_WITH, CONTAINS, CONTAINS_WORD"
  }

  validation {
    condition = alltrue([
      for route in var.restrictive_rate_limit_routes : contains([
        "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"
      ], route.method)
    ])
    error_message = "method must be one of: GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS"
  }
}

variable "restrictive_rate_limit" {
  description = "Restrictive rate limit for specific routes (requests per 5-minute period from a single IP)"
  type        = number
  default     = 10
}
