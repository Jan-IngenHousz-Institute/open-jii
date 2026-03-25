variable "dr_region" {
  description = "Destination AWS region for ECR cross-region replication (e.g. eu-west-1)."
  type        = string
}

variable "repository_names" {
  description = "List of ECR repository names to replicate. Each name produces one repository_filter block (PREFIX_MATCH) in the account-level replication rule."
  type        = list(string)
}
