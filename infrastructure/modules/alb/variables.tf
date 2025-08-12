variable "public_subnet_ids" {
  description = "List of public subnets for the ALB"
  type        = list(string)
}

variable "container_port" {
  description = "Port exposed by the container"
  type        = number
}

variable "service_name" {
  description = "Base name for the service"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the ALB should be created"
  type        = string
}

variable "security_groups" {
  description = "Security groups for ALB"
  type        = list(string)
}

variable "environment" {
  description = "Environment name (e.g., Dev, Staging, Prod)"
  type        = string
  default     = "Dev"
}

variable "idle_timeout" {
  description = "The time in seconds that the connection is allowed to be idle. Default is 60 seconds."
  type        = number
  default     = 60
}

variable "certificate_arn" {
  description = "ARN of the ACM certificate for HTTPS (if using SSL)"
  type        = string
  default     = ""
}

variable "health_check_path" {
  description = "Health check path for the target group"
  type        = string
  default     = "/health"
}

variable "health_check_timeout" {
  description = "Timeout in seconds for the health check"
  type        = number
  default     = 5
}

variable "health_check_interval" {
  description = "Interval in seconds for the health check"
  type        = number
  default     = 30
}

variable "health_check_healthy_threshold" {
  description = "Number of successful health checks before considering target healthy"
  type        = number
  default     = 3
}

variable "health_check_unhealthy_threshold" {
  description = "Number of failed health checks before considering target unhealthy"
  type        = number
  default     = 3
}

variable "health_check_matcher" {
  description = "HTTP status code(s) to consider as healthy response"
  type        = string
  default     = "200"
}

variable "enable_access_logs" {
  description = "Whether to enable access logs for the ALB"
  type        = bool
  default     = false
}

variable "access_logs_bucket" {
  description = "S3 bucket name to store ALB access logs"
  type        = string
  default     = ""
}

variable "tags" {
  description = "A map of tags to assign to resources"
  type        = map(string)
  default     = {}
}

variable "cloudfront_header_value" {
  description = "The value for the custom header that CloudFront sends to the ALB."
  type        = string
  sensitive   = true
}

variable "cloudfront_header_name" {
  description = "The name of the custom header that CloudFront sends to the ALB."
  type        = string
  default     = "X-Origin-Verify"
}
