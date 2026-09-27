variable "key" {
  description = "The key the code checks"
  type        = string
}

variable "name" {
  description = "What the flag is for"
  type        = string
  default     = ""
}

variable "active" {
  description = "Whether the flag is evaluated at all"
  type        = bool
}

variable "ensure_experience_continuity" {
  description = "Whether a person keeps their value after identifying"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags shown in PostHog"
  type        = list(string)
  default     = []
}

variable "filters" {
  description = "Release conditions, as PostHog stores them"
  type        = any
}
