variable "slack_webhook_url" {
  description = "Slack incoming webhook that error alerts post to."
  type        = string
  sensitive   = true
}

# Off while a deploy that newly reports errors opens its first burst of issues, so the burst is
# triaged once rather than posted one by one.
variable "error_alerts_enabled" {
  description = "Whether new, reopened and spiking error issues post to Slack."
  type        = bool
  default     = true
}
