variable "aws_region" {
  description = "The AWS region for resources"
  type        = string
}

variable "oidc_provider_url" {
  description = "The OIDC provider URL."
  type        = string
  default     = "https://token.actions.githubusercontent.com"
}

variable "client_id_list" {
  description = "The client IDs allowed for the OIDC provider."
  type        = list(string)
  default     = ["sts.amazonaws.com"]
}

variable "thumbprint_list" {
  description = "The thumbprint list for the OIDC provider."
  type        = list(string)
  default     = ["74f3a68f16524f15424927704c9506f55a9316bd"]
}

variable "role_name" {
  description = "Name of the OIDC IAM role."
  type        = string
}

variable "repository" {
  description = "GitHub repository in the format owner/repo (e.g., myorg/myrepo)"
  type        = string
}

variable "branch" {
  description = "The main branch allowed to assume the role (used in the OIDC condition). Pull requests are also allowed by default."
  type        = string
  default     = "main"
}

variable "github_environment" {
  description = "GitHub environment name for deployment protection. If provided, the role will trust both the environment AND branch-based access."
  type        = string
  default     = null
}

variable "services" {
  description = "List of AWS services this role needs permissions for"
  type        = list(string)
  default     = []
  validation {
    condition = alltrue([
      for service in var.services : contains([
        "s3", "s3-deploy", "ecr", "ecr-deploy", "lambda", "lambda-deploy",
        "cloudfront", "cloudfront-deploy", "ecs", "ecs-deploy", "dynamodb",
        "iam", "logs", "sqs", "vpc", "rds", "secretsmanager", "ses", "waf",
        "route53", "location-service", "timestream", "kinesis", "iot",
        "cognito", "terraform-backend", "alb", "ssm"
      ], service)
    ])
    error_message = "Invalid service specified. Allowed services: s3, s3-deploy, ecr, ecr-deploy, lambda, lambda-deploy, cloudfront, cloudfront-deploy, ecs, ecs-deploy, dynamodb, iam, logs, sqs, vpc, rds, secretsmanager, ses, waf, route53, location-service, timestream, kinesis, iot, cognito, terraform-backend, alb, ssm"
  }
}

variable "environment" {
  description = "Environment name (used for terraform backend bucket naming)"
  type        = string
  default     = "dev"
}
