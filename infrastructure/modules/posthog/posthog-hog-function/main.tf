resource "posthog_hog_function" "function" {
  name                  = var.name
  description           = var.description
  type                  = var.type
  template_id           = var.template_id
  enabled               = var.enabled
  execution_order       = var.execution_order
  icon_url              = var.icon_url
  hog                   = var.hog
  filters_json          = var.filters == null ? null : jsonencode(var.filters)
  inputs_json           = var.inputs == null ? null : jsonencode(var.inputs)
  sensitive_inputs_json = var.sensitive_inputs == null ? null : jsonencode(var.sensitive_inputs)
}
