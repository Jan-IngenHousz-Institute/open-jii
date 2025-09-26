variable "place_index_name" {
  description = "Name for the Place Index"
  type        = string
}

variable "data_source" {
  description = "Data source for the Place Index (e.g., Esri, Here, Grab)"
  type        = string
  default     = "Esri"

  validation {
    condition     = contains(["Esri", "Here", "Grab"], var.data_source)
    error_message = "Data source must be one of: Esri, Here, Grab."
  }
}

variable "description" {
  description = "Description for the Place Index"
  type        = string
  default     = "Place Index for search and geocoding operations"
}

variable "intended_use" {
  description = "Intended use for the Place Index (SingleUse or Storage)"
  type        = string
  default     = "SingleUse"

  validation {
    condition     = contains(["SingleUse", "Storage"], var.intended_use)
    error_message = "Intended use must be either 'SingleUse' or 'Storage'."
  }
}

variable "iam_policy_name" {
  description = "Name for the IAM policy"
  type        = string
  default     = "LocationServicePolicy"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}