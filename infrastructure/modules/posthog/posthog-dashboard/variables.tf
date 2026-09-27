variable "name" {
  description = "The dashboard's name"
  type        = string
}

variable "description" {
  description = "What the dashboard shows"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags shown in PostHog"
  type        = list(string)
  default     = []
}

variable "pinned" {
  description = "Whether the dashboard is pinned in PostHog's sidebar"
  type        = bool
  default     = false
}

variable "insights" {
  description = "Insights on the dashboard by key, each query as the JSON PostHog stores"
  type = map(object({
    name        = string
    description = string
    query_json  = string
  }))
}

variable "tiles" {
  description = "The layout in order: each tile an insight's key or a text body, with its layouts JSON"
  type = list(object({
    insight      = optional(string)
    text         = optional(string)
    color        = optional(string)
    layouts_json = string
  }))
}
