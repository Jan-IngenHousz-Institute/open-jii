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

variable "kinesis_shard_count" {
  description = "Shards of the ingest stream, which set the limits the Throughput and storage dashboard draws"
  type        = number
}

variable "storage_buckets" {
  description = "S3 buckets the Throughput and storage dashboard sizes, by what they hold"
  type        = map(string)
}

variable "payload_samples_log_group_name" {
  description = "Log group the IoT rule copies a share of ingest messages to, for the Data pipeline dashboard"
  type        = string
}

variable "posthog_project_id" {
  description = "PostHog project the daily report's errors section reads"
  type        = string
}

# Set only once the Infinity plugin is installed in the workspace; until then nothing reads PostHog.
variable "posthog_grafana_api_key" {
  description = "Read-only PostHog personal API key the daily report queries error tracking with"
  type        = string
  default     = ""
  sensitive   = true
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

variable "calibration_sandbox_function_name" {
  description = "Lambda function name for calibration-sandbox. Empty disables its panels and alerts."
  type        = string
  default     = ""
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

variable "ingest_lag_threshold_ms" {
  description = "Iterator age that counts as a stall. Dev's lag still peaks above two hours now and then, so its tolerance is raised in the env."
  type        = number
  default     = 600000
}

variable "experiment_latency_threshold_seconds" {
  description = "p95 seconds from silver to the experiment tables, per half hour, that counts as falling behind. Dev's runs higher on normal days, so its tolerance is raised in the env."
  type        = number
  default     = 60
}

variable "metrics_forwarder_function_name" {
  description = "Forwarder Lambda to watch. Empty leaves the self-health rules out entirely."
  type        = string
  default     = ""
}

variable "runbook_base_url" {
  description = "Where the repository's runbooks are read, so an alert's runbook_url opens the file"
  type        = string
  default     = "https://github.com/Jan-IngenHousz-Institute/open-jii/blob/main"
}

variable "aws_access_portal_url" {
  description = "IAM Identity Center access portal URL. When set, the reports' console links go through it into this environment's account; empty links straight to the console."
  type        = string
  default     = ""
}
