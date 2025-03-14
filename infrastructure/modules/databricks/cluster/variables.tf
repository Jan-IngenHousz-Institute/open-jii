variable "name" {
  description = "Name of the cluster"
  type        = string
}

variable "node_type_id" {
  description = "The node type ID to use for the cluster"
  type        = string
  default     = null
}

variable "single_node" {
  description = "Whether to create a single-node cluster"
  type        = bool
  default     = false
}

variable "num_workers" {
  description = "Number of workers for multi-node clusters"
  type        = number
  default     = 1
}

variable "autotermination_minutes" {
  description = "Automatically terminate the cluster after this many minutes of inactivity"
  type        = number
  default     = 20
}

variable "single_user" {
  description = "Whether to create a single-user cluster with SINGLE_USER data security mode"
  type        = bool
  default     = false
}

variable "single_user_name" {
  description = "The user name to assign to a single-user cluster (required when single_user=true)"
  type        = string
  default     = null
}

variable "spark_version" {
  description = "The Spark version to use for the cluster (e.g., '16.2.x-scala2.12'). If null, defaults to latest LTS."
  type        = string
  default     = null
}
