resource "posthog_action" "action" {
  name       = var.name
  steps_json = jsonencode(var.steps)
}
