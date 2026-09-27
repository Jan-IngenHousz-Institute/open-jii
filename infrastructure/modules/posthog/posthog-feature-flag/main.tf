# PostHog stores an empty name or tag list as absent, so they are sent that way.
resource "posthog_feature_flag" "flag" {
  key                          = var.key
  name                         = var.name == "" ? null : var.name
  active                       = var.active
  ensure_experience_continuity = var.ensure_experience_continuity
  tags                         = length(var.tags) > 0 ? var.tags : null
  filters                      = jsonencode(var.filters)
}
