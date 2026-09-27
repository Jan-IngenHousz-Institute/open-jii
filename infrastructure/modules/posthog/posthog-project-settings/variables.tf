variable "autocapture_exceptions" {
  description = "Whether the web SDK captures uncaught exceptions"
  type        = bool
}

variable "autocapture_web_vitals" {
  description = "Whether the web SDK captures web vitals"
  type        = bool
}

variable "capture_performance" {
  description = "Whether the web SDK captures network performance"
  type        = bool
}

variable "heatmaps" {
  description = "Whether the web SDK captures heatmap data"
  type        = bool
}

variable "session_recording" {
  description = "Whether sessions are recorded"
  type        = bool
}

variable "cookieless_server_hash_mode" {
  description = "PostHog's cookieless tracking mode, 0 for off"
  type        = number
}

variable "app_urls" {
  description = "URLs the toolbar and heatmaps may open"
  type        = list(string)
}

variable "test_account_filters" {
  description = "Filters \"Filter out internal and test users\" applies, as PostHog stores them"
  type        = any
}
