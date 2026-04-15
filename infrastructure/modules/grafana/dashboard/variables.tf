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

variable "grafana_db_username" {
  description = "Grafana database username"
  type        = string
  default     = "grafana_readonly"
}

variable "db_host" {
  description = "Aurora cluster writer endpoint hostname"
  type        = string
}

variable "db_port" {
  description = "Aurora cluster port (default 5432)"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "Name of the PostgreSQL database to connect to"
  type        = string
}
