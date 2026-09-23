variable "catalog_name" {
  description = "Name of the parent catalog. Change forces the creation of a new resource."
  type        = string
}

variable "schema_name" {
  description = "Name of the parent schema relative to the parent catalog. Change forces the creation of a new resource."
  type        = string
}

variable "name" {
  description = "Name of the table relative to the parent catalog and schema. Change forces the creation of a new resource."
  type        = string
}

variable "table_type" {
  description = "Must be one of MANAGED, EXTERNAL or VIEW. Change forces the creation of a new resource."
  type        = string
  default     = "MANAGED"

  validation {
    condition     = contains(["MANAGED", "EXTERNAL", "VIEW"], var.table_type)
    error_message = "table_type must be one of MANAGED, EXTERNAL or VIEW."
  }
}

variable "view_definition" {
  description = "The SELECT a VIEW stores. Only for table_type VIEW."
  type        = string
  default     = null
}

variable "warehouse_id" {
  description = "SQL warehouse that runs the DDL. Without one the provider starts a cluster."
  type        = string
  default     = null
}

variable "comment" {
  description = "User-supplied free-form text describing the table."
  type        = string
  default     = ""
}

variable "columns" {
  description = "List of column definitions for the table."
  type = list(object({
    name     = string
    type     = string
    comment  = optional(string, "")
    nullable = optional(bool, true)
    identity = optional(string)
  }))
  default = []
}

variable "properties" {
  description = "A map of table properties."
  type        = map(string)
  default     = {}
}

variable "grants" {
  description = "Map of principals to their permissions on the table."
  type = map(object({
    principal  = string
    privileges = list(string)
  }))
  default = {}
}
