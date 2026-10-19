variable "catalog_name" {
  description = "The name of the Databricks catalog that contains the schema"
  type        = string
}

variable "schema_name" {
  description = "The name of the schema where the volume will be created"
  type        = string
}

variable "volume_name" {
  description = "The name of the volume to create"
  type        = string
}

variable "comment" {
  description = "A human-readable comment describing the purpose of this volume"
  type        = string
  default     = ""
}

variable "storage_location" {
  description = "S3 path inside an external location; set it to create an external volume, leave it null for a managed one"
  type        = string
  default     = null
}

variable "grants" {
  description = "Map of principals to their permissions on the volume"
  type = map(object({
    principal  = string
    privileges = list(string)
  }))
  default = {}
}
