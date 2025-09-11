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

variable "large_body_endpoints" {
  description = "List of endpoints that should allow large request bodies (up to 1024MB). These endpoints will be rate-limited to 5 requests per minute per IP and will bypass the standard AWS Managed Rules body size restrictions."
  type        = list(string)
  default     = []
  
  validation {
    condition = alltrue([
      for endpoint in var.large_body_endpoints :
      can(regex("^/", endpoint))
    ])
    error_message = "All endpoints must start with a forward slash (/)."
  }
}

variable "large_body_endpoints" {
  description = "List of backend endpoints (evaluated by ENDS_WITH) that should allow large request bodies (up to 1024MB). These endpoints will be rate-limited to 5 requests per minute per IP and will bypass the standard AWS Managed Rules body size restrictions."
  type        = list(string)
  default     = []
  
  validation {
    condition = alltrue([
      for endpoint in var.large_body_endpoints :
      can(regex("^/", endpoint))
    ])
    error_message = "All backend endpoints must start with a forward slash (/)."
  }
}

variable "tags" {
  description = "A map of tags to assign to resources"
  type        = map(string)
  default     = {}
}
