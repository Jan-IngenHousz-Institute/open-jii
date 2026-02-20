variable "repository_name" {
  description = "Name of the ECR repository"
  type        = string
}

variable "force_delete" {
  description = "If true, will delete the repository even if it contains images. Should be false for production environments."
  type        = bool
  default     = false
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "max_image_count" {
  description = "Maximum number of images to keep in the repository"
  type        = number
  default     = 10
}

variable "tags" {
  description = "A map of tags to assign to the resource"
  type        = map(string)
  default     = {}
}

variable "aws_region" {
  description = "AWS region where resources will be created"
  type        = string
}

variable "image_tag_mutability" {
  description = "The tag mutability setting for the repository. Must be one of: MUTABLE, IMMUTABLE, or IMMUTABLE_WITH_EXCLUSION"
  type        = string
  default     = "IMMUTABLE"

  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE", "IMMUTABLE_WITH_EXCLUSION"], var.image_tag_mutability)
    error_message = "Image tag mutability must be either MUTABLE, IMMUTABLE, or IMMUTABLE_WITH_EXCLUSION."
  }
}

variable "enable_vulnerability_scanning" {
  description = "Enable vulnerability scanning on push"
  type        = bool
  default     = true
}

variable "encryption_type" {
  description = "Encryption type to use for the repository. Valid values are AES256 or KMS"
  type        = string
  default     = "AES256"

  validation {
    condition     = contains(["AES256", "KMS"], var.encryption_type)
    error_message = "Encryption type must be either AES256 or KMS."
  }
}

variable "kms_key_id" {
  description = "The KMS key ID to use for encryption (only if encryption_type is KMS)"
  type        = string
  default     = null
}

variable "service_name" {
  description = "Name of the service using this ECR repository (e.g., for ECS service ARN construction in policy)"
  type        = string
}

variable "ci_cd_role_arn" {
  description = "ARN of the IAM role used by the CI/CD system to push images"
  type        = string
  default     = null
}

variable "create_repository_policy" {
  description = "Whether to create the ECR repository policy. Set to false for Lambda-only repos that authenticate via IAM role, not repo policy."
  type        = bool
  default     = true
}
