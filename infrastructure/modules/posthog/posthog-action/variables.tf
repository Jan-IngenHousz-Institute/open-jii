variable "name" {
  description = "The action's name"
  type        = string
}

variable "steps" {
  description = "Steps that match the action, as PostHog stores them"
  type        = any
}
