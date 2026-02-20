variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "isolated_subnet_ids" {
  description = "Isolated subnet IDs (no IGW, no NAT) where Lambda functions run"
  type        = list(string)
}

variable "lambda_sg_id" {
  description = "Security group ID for macro-runner Lambda functions (created by the VPC module)"
  type        = string
}

# ---- ECR (provided by the ECR module) ----

variable "ecr_repository_urls" {
  description = "ECR repository URLs keyed by language (python, js, r)"
  type        = map(string)
}

variable "ecr_repository_arns" {
  description = "ECR repository ARNs keyed by language (python, js, r) — used for IAM ECR-pull policy"
  type        = map(string)
}

# ---- Flow Logs (provided by the vpc-flow-logs module) ----

variable "flow_log_group_name" {
  description = "CloudWatch log group name for VPC flow logs — used for rejected-traffic metric filter"
  type        = string
}

# ---- Lambda configuration ----

variable "lambda_functions" {
  description = "Per-language Lambda configuration overrides"
  type = map(object({
    memory  = number
    timeout = number
  }))
  default = {
    python = {
      memory  = 1024 # numpy/scipy need ~1GB
      timeout = 65   # 60s max script + 5s overhead
    }
    js = {
      memory  = 512 # Node.js is lightweight
      timeout = 65
    }
    r = {
      memory  = 1024 # R + jsonlite needs decent memory
      timeout = 65
    }
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention for Lambda function logs"
  type        = number
  default     = 7
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
