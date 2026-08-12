variable "credential_name" {
  description = "Name of the storage credential"
  type        = string
}

variable "role_name" {
  description = "Name of the IAM role for storage access"
  type        = string
}

variable "environment" {
  description = "Environment name (dev/prod)"
  type        = string
}

variable "bucket_name" {
  description = "Name of the centralized metastore S3 bucket"
  type        = string
}

variable "isolation_mode" {
  description = "Isolation mode for the storage credential (ISOLATION_MODE_ISOLATED or ISOLATION_MODE_OPEN)"
  type        = string
  default     = "ISOLATION_MODE_ISOLATED"
}

variable "additional_policy_arns" {
  description = "Additional IAM policy ARNs to attach to the storage credential role"
  type        = list(string)
  default     = []
}

variable "additional_bucket_access" {
  description = "Extra S3 buckets this role should reach, keyed by a short name used in the policy name. Renders and attaches one IAM policy per bucket. Use for buckets owned outside Terraform or by a module that does not emit its own policy; buckets whose owning module already exposes a policy ARN belong in additional_policy_arns instead."
  type = map(object({
    bucket_name = string
    read_only   = optional(bool, false)
  }))
  default = {}
}
