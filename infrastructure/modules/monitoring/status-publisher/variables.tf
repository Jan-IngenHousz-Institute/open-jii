variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
}

variable "site_bucket_id" {
  description = "Public bucket the status page is served from; the publisher writes its data/status.json"
  type        = string
}

variable "site_bucket_arn" {
  description = "ARN of the public site bucket"
  type        = string
}

variable "state_bucket_id" {
  description = "Private bucket holding the publisher's running history"
  type        = string
}

variable "state_bucket_arn" {
  description = "ARN of the state bucket"
  type        = string
}

variable "web_url" {
  description = "Public https URL of a web app page that reads nothing from the backend, which the website check requests"
  type        = string
}

variable "api_health_url" {
  description = "Public https URL of the backend's health endpoint"
  type        = string
}

variable "load_balancer_arn" {
  description = "Backend ALB ARN, from which the CloudWatch LoadBalancer dimension is derived"
  type        = string
}

variable "web_distribution_id" {
  description = "CloudFront distribution serving the web app"
  type        = string
}

variable "kinesis_stream_name" {
  description = "Ingest stream whose metrics the data intake check reads"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention for the status publisher's log group"
  type        = number
  default     = 30
}
