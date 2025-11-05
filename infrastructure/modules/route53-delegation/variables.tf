variable "parent_zone_id" {
  description = "The ID of the parent Route 53 hosted zone where the delegation record will be created."
  type        = string
}

variable "subdomain" {
  description = "The subdomain to delegate (e.g., 'dev.example.com')."
  type        = string
}

variable "name_servers" {
  description = "A list of name servers for the subdomain's hosted zone. Either this or ssm_parameter_config must be provided."
  type        = list(string)
  default     = null
}

variable "ssm_parameter_config" {
  description = "Configuration for reading nameservers from SSM Parameter Store in another account. Either this or name_servers must be provided."
  type = object({
    parameter_name    = string # SSM parameter name (e.g., '/open-jii/route53/dev-nameservers')
    source_account_id = string # AWS account ID where the parameter is stored
    assume_role_name  = string # IAM role name to assume in the source account
    aws_region        = string # AWS region where the parameter is stored
  })
  default = null
}

variable "tags" {
  description = "A map of tags to assign to the resources."
  type        = map(string)
  default     = {}
}
