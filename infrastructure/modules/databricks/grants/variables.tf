variable "catalog_name" {
  description = "Name of the parent catalog"
  type        = string
}

variable "schema_name" {
  description = "Name of the schema to grant permissions on"
  type        = string
}

variable "grants" {
  description = "Map of principals to their permissions on the schema"
  type = map(object({
    principal  = string
    privileges = list(string)
  }))
  default = {}
}
