# Only the settings passed here are owned; anything omitted keeps PostHog's current value.
resource "posthog_project_settings" "project" {
  autocapture_exceptions_opt_in = var.autocapture_exceptions
  autocapture_web_vitals_opt_in = var.autocapture_web_vitals
  capture_performance_opt_in    = var.capture_performance
  heatmaps_opt_in               = var.heatmaps
  session_recording_opt_in      = var.session_recording
  cookieless_server_hash_mode   = var.cookieless_server_hash_mode
  app_urls                      = var.app_urls
  test_account_filters          = jsonencode(var.test_account_filters)
}
