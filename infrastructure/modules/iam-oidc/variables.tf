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

variable "environment" {
  description = "Environment name (used for terraform backend bucket naming)"
  type        = string
  default     = "dev"
}

variable "github_environments" {
  description = "GitHub environments whose jobs may assume the role. Each one's deployment branch policy decides which refs reach this account."
  type        = list(string)
}

variable "allowed_refs" {
  description = "Git refs whose runs may assume the role, wildcards allowed. Null allows any ref the environments admit."
  type        = list(string)
  default     = null
}

variable "plan_role_github_environment" {
  description = "GitHub environment whose jobs may assume the read-only plan role. Null creates no plan role."
  type        = string
  default     = null
}

variable "plan_role_name" {
  description = "Name of the read-only plan role."
  type        = string
  default     = "GithubActionsPlanAccess"
}

variable "enabled_services" {
  description = "Subset of service policy keys to enable. Null (default) enables all services. Use to restrict permissions in environments that don't need every service."
  type        = list(string)
  default     = null
}
