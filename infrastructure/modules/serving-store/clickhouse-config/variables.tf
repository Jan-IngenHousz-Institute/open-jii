variable "http_port" {
  description = "Port the store answers HTTP on"
  type        = number
}

variable "prometheus_port" {
  description = "Port the store serves its Prometheus metrics on"
  type        = number
}

variable "system_log_retention_days" {
  description = "Days ClickHouse keeps its own system logs (queries, parts, metrics)"
  type        = number
}

variable "password_sha256" {
  description = "Each role's password as a SHA-256 hex digest, keyed as the users output is"
  type        = map(string)
}
