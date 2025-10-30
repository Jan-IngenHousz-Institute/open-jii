variable "share_name" {
  description = "The name of the Delta Sharing share. Must be unique within the metastore. Use lowercase letters, numbers, and underscores."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9_]+$", var.share_name))
    error_message = "Share name must contain only lowercase letters, numbers, and underscores."
  }
}

variable "catalog_name" {
  description = "The name of the catalog containing the schemas to share."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9_]+$", var.catalog_name))
    error_message = "Catalog name must contain only lowercase letters, numbers, and underscores."
  }
}

variable "comment" {
  description = "Optional comment describing the purpose of this share. Helps with documentation and governance."
  type        = string
  default     = null
}

variable "schemas" {
  description = <<-EOT
    List of schemas to include in the share initially. Each schema will share all tables, views, and volumes within it.
    
    Note: Additional schemas can be added programmatically at runtime (e.g., experiment schemas).
    This list should contain schemas that are known at Terraform plan time (e.g., 'central').
    
    Required:
    - name: Schema name within the catalog
    
    Optional:
    - comment: Description of what's being shared from this schema
    
    Dynamic Updates:
    - Once a schema is shared, all future tables in that schema are automatically visible to recipients
    - New schemas can be added via Databricks SDK without Terraform reapplication
  EOT
  type = list(object({
    name    = string
    comment = optional(string)
  }))
  
  default = []  # Allow empty list - schemas can be added programmatically

  validation {
    condition = alltrue([
      for schema in var.schemas : can(regex("^[a-z0-9_]+$", schema.name))
    ])
    error_message = "Each schema name must contain only lowercase letters, numbers, and underscores."
  }
}
