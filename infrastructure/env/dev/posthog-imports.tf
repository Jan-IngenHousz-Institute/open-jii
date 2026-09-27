# Adopts the PostHog objects that were set up by hand, so the first apply changes nothing it
# already has. Once that apply has run, these blocks are no-ops and can be deleted.
import {
  to = module.posthog.module.project_settings.posthog_project_settings.project
  id = "80726"
}

import {
  to = module.posthog.module.platform_action.posthog_action.action
  id = "103940"
}

import {
  for_each = {
    "iot-devices"                    = "226867"
    "workbook-deletion"              = "201049"
    "macro-deletion"                 = "118632"
    "experiment-deletion"            = "118631"
    "protocol-deletion"              = "118630"
    "protocol-validation-as-warning" = "114490"
    "multi-language"                 = "108478"
  }
  to = module.posthog.module.feature_flag[each.key].posthog_feature_flag.flag
  id = each.value
}

import {
  for_each = {
    "landing_pages"     = "347201"
    "iot_devices_usage" = "818770"
    "my_app"            = "223539"
  }
  to = module.posthog.module.dashboard[each.key].posthog_dashboard.dashboard
  id = each.value
}

import {
  for_each = {
    "landing_pages"     = "80726/347201"
    "iot_devices_usage" = "80726/818770"
    "my_app"            = "80726/223539"
  }
  to = module.posthog.module.dashboard[each.key].posthog_dashboard_layout.layout
  id = each.value
}

import {
  for_each = {
    "landing-pages-unique-sessions-trend"                                   = { dashboard = "landing_pages", id = "2042673" }
    "landing-pages-unique-users-on-landing-page-s"                          = { dashboard = "landing_pages", id = "2042681" }
    "landing-pages-average-session-duration"                                = { dashboard = "landing_pages", id = "2042684" }
    "landing-pages-most-popular-landing-pages"                              = { dashboard = "landing_pages", id = "2042675" }
    "landing-pages-referring-domains"                                       = { dashboard = "landing_pages", id = "2042677" }
    "landing-pages-pages-per-session"                                       = { dashboard = "landing_pages", id = "2042682" }
    "landing-pages-new-returning-users"                                     = { dashboard = "landing_pages", id = "2042678" }
    "landing-pages-which-country-are-users-from"                            = { dashboard = "landing_pages", id = "2042672" }
    "landing-pages-unique-users-by-browser"                                 = { dashboard = "landing_pages", id = "2042669" }
    "landing-pages-unique-users-by-device-type"                             = { dashboard = "landing_pages", id = "2042680" }
    "iot-devices-usage-feature-flag-called-total-volume"                    = { dashboard = "iot_devices_usage", id = "4991556" }
    "iot-devices-usage-feature-flag-calls-made-by-unique-users-per-variant" = { dashboard = "iot_devices_usage", id = "4991557" }
    "my-app-daily-active-users"                                             = { dashboard = "my_app", id = "1258965" }
    "my-app-weekly-active-users"                                            = { dashboard = "my_app", id = "1258966" }
    "my-app-retention"                                                      = { dashboard = "my_app", id = "1258967" }
    "my-app-growth-accounting"                                              = { dashboard = "my_app", id = "1258968" }
    "my-app-referring-domain"                                               = { dashboard = "my_app", id = "1258969" }
    "my-app-pageview-funnel-by-browser"                                     = { dashboard = "my_app", id = "1258970" }
  }
  to = module.posthog.module.dashboard[each.value.dashboard].posthog_insight.insight[each.key]
  id = each.value.id
}

import {
  to = module.posthog.module.geoip.posthog_hog_function.function
  id = "01985fc1-54cf-0000-7de0-ae9dbb7edb3b"
}
