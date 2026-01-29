variable "function_name" {
  description = "Name of the Lambda function"
  type        = string
}

variable "handler" {
  description = "Lambda function handler"
  type        = string
  default     = "index.mjs"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs18.x"
}

variable "architecture" {
  description = "Lambda architecture"
  type        = string
  default     = "arm64"

  validation {
    condition     = contains(["x86_64", "arm64"], var.architecture)
    error_message = "Architecture must be either x86_64 or arm64."
  }
}

variable "memory_size" {
  description = "Memory size in MB"
  type        = number
  default     = 512

  validation {
    condition     = var.memory_size >= 128 && var.memory_size <= 10240
    error_message = "Memory size must be between 128 and 10240 MB."
  }
}

variable "timeout" {
  description = "Timeout in seconds"
  type        = number
  default     = 30

  validation {
    condition     = var.timeout >= 1 && var.timeout <= 900
    error_message = "Timeout must be between 1 and 900 seconds."
  }
}

variable "environment_variables" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "function_url_authorization_type" {
  description = "The authorization type for the function URL. Can be NONE or AWS_IAM."
  type        = string
  default     = "NONE"
}

variable "create_function_url" {
  description = "Whether to create a Lambda function URL"
  type        = bool
  default     = true
}

variable "s3_permissions" {
  description = "Whether to grant S3 permissions to the Lambda function"
  type        = bool
  default     = false
}

variable "dynamodb_permissions" {
  description = "Whether to grant DynamoDB permissions to the Lambda function"
  type        = bool
  default     = false
}

variable "sqs_permissions" {
  description = "Whether to grant SQS permissions to the Lambda function"
  type        = bool
  default     = false
}

variable "lambda_permissions" {
  description = "Whether to grant Lambda invoke permissions to the Lambda function"
  type        = bool
  default     = false
}

variable "lambda_package_path" {
  description = "Path to the Lambda deployment package (zip file)"
  type        = string
  default     = null
}

variable "s3_bucket_arns" {
  description = "List of S3 bucket ARNs to grant access to"
  type        = list(string)
  default     = []
}

variable "dynamodb_table_arns" {
  description = "List of DynamoDB table ARNs to grant access to"
  type        = list(string)
  default     = []
}

variable "sqs_queue_arns" {
  description = "List of SQS queue ARNs to grant access to"
  type        = list(string)
  default     = []
}

variable "lambda_function_arns" {
  description = "List of Lambda function ARNs to grant invoke access to"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "lambda_layers" {
  description = "List of Lambda Layer ARNs to attach to the function."
  type        = list(string)
  default     = []
}

variable "additional_iam_policies" {
  description = "A map of additional IAM policies to attach to the Lambda role. Keys are policy names, values are JSON policy documents."
  type        = map(string)
  default     = {}
}

variable "use_alias_url" {
  description = "Whether to create a Lambda function alias for the specified environment"
  type        = bool
  default     = false
}
