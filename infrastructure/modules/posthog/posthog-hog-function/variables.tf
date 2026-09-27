variable "name" {
  description = "The function's name"
  type        = string
}

variable "description" {
  description = "What the function does"
  type        = string
  default     = null
}

variable "type" {
  description = "PostHog's function type, such as transformation or internal_destination"
  type        = string
}

variable "template_id" {
  description = "The PostHog template the function is built from"
  type        = string
  default     = null
}

variable "enabled" {
  description = "Whether the function runs"
  type        = bool
  default     = true
}

variable "execution_order" {
  description = "Where a transformation runs among the others"
  type        = number
  default     = null
}

variable "icon_url" {
  description = "The icon PostHog shows"
  type        = string
  default     = null
}

variable "hog" {
  description = "The function's Hog code, when it is not the template's own"
  type        = string
  default     = null
}

variable "filters" {
  description = "Which events the function runs on, as PostHog stores them"
  type        = any
  default     = null
}

variable "inputs" {
  description = "The template's inputs"
  type        = any
  default     = null
}

variable "sensitive_inputs" {
  description = "Inputs PostHog stores encrypted, such as a webhook URL"
  type        = any
  default     = null
  sensitive   = true
}
