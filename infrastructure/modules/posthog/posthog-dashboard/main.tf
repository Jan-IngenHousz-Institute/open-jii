# A dashboard with its insights and their layout. PostHog stores an empty description or tag list
# as absent, so they are sent that way.
resource "posthog_dashboard" "dashboard" {
  name        = var.name
  description = var.description == "" ? null : var.description
  tags        = length(var.tags) > 0 ? var.tags : null
  pinned      = var.pinned
}

resource "posthog_insight" "insight" {
  for_each = var.insights

  name          = each.value.name
  description   = each.value.description == "" ? null : each.value.description
  query_json    = each.value.query_json
  dashboard_ids = [posthog_dashboard.dashboard.id]
}

resource "posthog_dashboard_layout" "layout" {
  dashboard_id = posthog_dashboard.dashboard.id
  tiles = [
    for tile in var.tiles : {
      insight_id   = tile.insight == null ? null : posthog_insight.insight[tile.insight].id
      text_body    = tile.text
      color        = tile.color
      layouts_json = tile.layouts_json
    }
  ]
}
