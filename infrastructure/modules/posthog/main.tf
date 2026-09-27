# openJII's PostHog project. Its configuration lives here and in the JSON and query files beside
# it; each kind of object is created by a generic submodule.
locals {
  # Keyed by the flag keys `packages/analytics` checks; a test there holds the two sets equal, so a
  # flag the code reads always exists here. A release or a rollback is a change to flags.json.
  feature_flags = jsondecode(file("${path.module}/flags.json"))

  # Each insight's query is the JSON PostHog stores, in insights/<key>.json, so a change made in the
  # UI can be exported and pasted back.
  dashboards = jsondecode(file("${path.module}/dashboards.json"))

  # PostHog's link to an issue by fingerprint, which stays valid after issues are merged.
  error_issue_link = "{project.url}/error_tracking/fingerprint/{replaceAll(replaceAll(encodeURLComponent(event.properties.fingerprint), '(', '%28'), ')', '%29')}?timestamp={event.properties.exception_timestamp}"

  error_alerts = {
    created  = { event = "$error_tracking_issue_created", headline = "New error" }
    reopened = { event = "$error_tracking_issue_reopened", headline = "Error back after being resolved" }
    spiking  = { event = "$error_tracking_issue_spiking", headline = "Error spiking" }
  }
}

module "project_settings" {
  source = "./posthog-project-settings"

  autocapture_exceptions = true
  autocapture_web_vitals = true
  capture_performance    = true
  heatmaps               = true
  session_recording      = true
  # Visitors who decline cookies are counted with a daily-salted server hash instead, which web's
  # `cookieless_mode: "on_reject"` needs; 0 drops those events.
  cookieless_server_hash_mode = 1
  app_urls                    = ["https://dev.openjii.org", "https://openjii.org", "http://localhost:3000"]

  # "Filter out internal and test users" keeps an event only when every filter holds, so usage
  # numbers count researchers rather than the team and its testers. The testers cohort is kept in
  # PostHog by id, since its members are listed by email.
  test_account_filters = [
    { key = "$host", type = "event", value = "^(localhost|127\\.0\\.0\\.1)($|:)", operator = "not_regex" },
    { key = "email", type = "person", value = "@(jii\\.org|jan-ingenhousz-institute\\.org|openjii\\.local)$", operator = "not_regex" },
    { key = "id", type = "cohort", value = 182121, operator = "not_in" },
  ]
}

module "platform_action" {
  source = "./posthog-action"

  name = "platform"
  # As PostHog stores the step, including the regex it derives from the selector.
  steps = [{
    event          = "$autocapture"
    selector       = "a > .relative"
    selector_regex = "(^|;).*?\\.relative[^;]*?($|;|:([^;^\\s]*(;|$|\\s)))a[^;]*?($|;|:([^;^\\s]*(;|$|\\s))).*"
    url_matching   = "exact"
    href           = null
    href_matching  = null
    properties     = null
    tag_name       = null
    text           = null
    text_matching  = null
    url            = null
  }]
}

module "feature_flag" {
  source = "./posthog-feature-flag"
  # Keyed by flag key: the flags' filters differ in shape, so they cannot form a map of their own.
  for_each = toset(keys(local.feature_flags))

  key                          = each.key
  name                         = local.feature_flags[each.key].name
  active                       = local.feature_flags[each.key].active
  ensure_experience_continuity = local.feature_flags[each.key].continuity
  tags                         = local.feature_flags[each.key].tags
  filters                      = local.feature_flags[each.key].filters
}

module "dashboard" {
  source   = "./posthog-dashboard"
  for_each = local.dashboards.dashboards

  name        = each.value.name
  description = each.value.description
  tags        = each.value.tags
  pinned      = each.value.pinned
  insights = {
    for key, insight in local.dashboards.insights : key => {
      name        = insight.name
      description = insight.description
      query_json  = jsonencode(jsondecode(file("${path.module}/insights/${key}.json")))
    } if insight.dashboard == each.key
  }
  tiles = [
    for tile in local.dashboards.tiles[each.key] : {
      insight      = try(tile.insight, null)
      text         = try(tile.text, null)
      color        = try(tile.color, null)
      layouts_json = jsonencode(tile.layouts)
    }
  ]
}

# The GeoIP transformation PostHog set up with the project, which adds each event's location from
# its IP address. Its code is PostHog's template, kept in transformations/ as it is stored.
module "geoip" {
  source = "./posthog-hog-function"

  name            = "GeoIP"
  description     = "Enrich events with GeoIP data"
  type            = "transformation"
  template_id     = "template-geoip"
  execution_order = 1
  icon_url        = "/static/transformations/geoip.png"
  hog             = chomp(file("${path.module}/transformations/geoip.hog"))
  filters         = { source = "events" }
}

# Error-tracking alerts, built the way PostHog's own "HTTP Webhook on issue ..." templates are, with
# a body Slack's incoming webhooks accept. Issues span every environment, so these are project-wide.
module "error_alert" {
  source   = "./posthog-hog-function"
  for_each = local.error_alerts

  name        = "Slack: ${lower(each.value.headline)}"
  description = "Posts to Slack when an error-tracking issue is ${each.key}."
  type        = "internal_destination"
  template_id = "template-webhook"
  enabled     = var.error_alerts_enabled

  filters = {
    source = "internal-events"
    events = [{ id = each.value.event, type = "events" }]
  }

  inputs = {
    method = { value = "POST" }
    body = {
      value = {
        text = "*${each.value.headline}:* {event.properties.name}: {event.properties.description}\n<${local.error_issue_link}|Open in PostHog>"
      }
    }
  }

  sensitive_inputs = {
    url = { value = var.slack_webhook_url }
  }
}
