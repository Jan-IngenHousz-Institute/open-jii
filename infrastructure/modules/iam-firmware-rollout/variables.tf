variable "aws_region" {
  description = "AWS region the IoT jobs and things live in"
  type        = string
}

variable "environment" {
  description = "Environment name, used in the role name and the trusted GitHub environment"
  type        = string
}

variable "oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider (output of the iam-oidc module); this module never creates one"
  type        = string
}

variable "repository" {
  description = "GitHub repository allowed to assume the role"
  type        = string
  default     = "Jan-IngenHousz-Institute/open-jii"
}

variable "firmware_bucket_arn" {
  description = "ARN of the firmware artifact bucket the rollout uploads to"
  type        = string
}

variable "presign_role_arn" {
  description = "ARN of the role AWS IoT Jobs assumes to presign firmware objects; the rollout must be able to pass it"
  type        = string
}
