variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "project" {
  type    = string
  default = "open-jii"
}

variable "environment" {
  description = "The deployment environment (e.g., dev, staging, prod)"
  type        = string
}

variable "server_function_name" {
  description = "The name of the server function to monitor"
  type        = string
}

variable "load_balancer_arn" {
  description = "The ARN of the load balancer to monitor"
  type        = string
}

variable "target_group_arn" {
  description = "The ARN of the target group to monitor"
  type        = string
}

variable "ecs_cluster_name" {
  description = "The name of the ECS cluster to monitor"
  type        = string
}

variable "ecs_service_name" {
  description = "The name of the ECS service to monitor"
  type        = string
}

variable "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution to monitor"
  type        = string
}

variable "slack_webhook_url" {
  description = "Slack webhook url"
  type        = string
}

variable "db_cluster_identifier" {
  description = "The identifier of the Aurora DB cluster to monitor"
  type        = string
}

variable "kinesis_stream_name" {
  description = "The name of the Kinesis Data Stream to monitor"
  type        = string
}

variable "ecs_log_group_name" {
  description = "The CloudWatch Log Group name for ECS backend container logs"
  type        = string
}

variable "iot_log_group_name" {
  description = "The CloudWatch Log Group name for IoT Core logs"
  type        = string
  default     = "AWSIotLogsV2"
}

variable "macro_sandbox_function_names" {
  description = "Lambda function names for macro-sandbox, keyed by language (python, js, r)"
  type        = map(string)
  default     = {}
}

variable "large_iot_notification_queue_name" {
  description = "Name of the SQS notification queue for large-iot payloads"
  type        = string
  default     = ""
}

variable "large_iot_dlq_name" {
  description = "Name of the SQS dead-letter queue for large-iot payloads"
  type        = string
  default     = ""
}

variable "large_iot_ingestion_lag_threshold_seconds" {
  description = "Seconds before the ingestion lag alert fires (ApproximateAgeOfOldestMessage). Set higher in dev where the pipeline runs less frequently."
  type        = number
  default     = 900 # 15 minutes
}

variable "enable_site_availability_alert" {
  description = "Whether to create the Route53 health-check-based site availability alert. Must be a static bool (not derived from health_check_id) since it gates a resource count. Defaults to false so environments without a Route53 health check configured don't get a permanently-alerting rule with an empty HealthCheckId."
  type        = bool
  default     = false
}

variable "route53_health_check_id" {
  description = "Route53 health check ID for active site-up monitoring. Only used when enable_site_availability_alert is true."
  type        = string
  default     = ""
}


