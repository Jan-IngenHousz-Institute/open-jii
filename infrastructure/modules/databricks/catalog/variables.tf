variable "catalog_name" {
  description = "The name of the Databricks catalog. Must be unique within the workspace, start with a letter or underscore, and contain only alphanumeric characters and underscores."
  type        = string
  default     = "open_jii_dev"
}

variable "catalog_comment" {
  description = "A human-readable comment describing the purpose of the catalog. This helps with documentation and discoverability."
  type        = string
  default     = "Catalog for agricultural sensor data, containing schemas for various experiments."
}
