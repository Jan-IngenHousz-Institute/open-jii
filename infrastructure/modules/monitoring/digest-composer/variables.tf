variable "environment" {
  description = "Deployment environment (dev, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region for CloudWatch metric queries"
  type        = string
}

variable "kinesis_stream_name" {
  description = "IoT ingest Kinesis stream name"
  type        = string
}

variable "alb_arn" {
  description = "Backend ALB ARN; the CloudWatch dimension suffix is derived from it"
  type        = string
}

variable "cloudfront_distribution_id" {
  description = "OpenNext CloudFront distribution id"
  type        = string
}

variable "server_function_name" {
  description = "OpenNext server Lambda function name"
  type        = string
}

variable "macro_function_names" {
  description = "Sandbox Lambda function names the errors signal covers, macro and calibration"
  type        = list(string)
}

variable "db_cluster_identifier" {
  description = "Aurora cluster identifier"
  type        = string
}

variable "heartbeat_webhook_url" {
  description = "Slack incoming webhook the observability digest posts to; empty logs the digest instead"
  type        = string
  sensitive   = true
  default     = ""
}

variable "usage_webhook_url" {
  description = "Slack incoming webhook the usage digests post to; empty logs the digest instead"
  type        = string
  sensitive   = true
  default     = ""
}

variable "runbook_base_url" {
  description = "Base URL for runbook links in digests"
  type        = string
  default     = "https://github.com/Jan-IngenHousz-Institute/open-jii/blob/main"
}

variable "log_retention_days" {
  description = "CloudWatch log retention for the composer's log group"
  type        = number
  default     = 7
}

variable "grafana_endpoint" {
  description = "Grafana workspace URL, so a digest can link the report for its run; empty omits the link"
  type        = string
  default     = ""
}
