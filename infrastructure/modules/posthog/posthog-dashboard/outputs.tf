output "id" {
  description = "The dashboard's id"
  value       = posthog_dashboard.dashboard.id
}

output "insight_ids" {
  description = "The insights' ids by key"
  value       = { for key, insight in posthog_insight.insight : key => insight.id }
}
