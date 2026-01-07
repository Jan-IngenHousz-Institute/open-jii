output "amg_url" {
  value       = "https://${aws_grafana_workspace.this.endpoint}"
  description = "AMG workspace URL - use in the Grafana provider (var.grafana_url)"
}

output "service_account_token" {
  description = "The service account token for the Grafana workspace admin."
  value       = aws_grafana_workspace_service_account_token.admin_token.key
  sensitive   = true
}
