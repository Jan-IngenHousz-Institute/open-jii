output "amg_url" {
  value       = aws_grafana_workspace.this.endpoint
  description = "AMG workspace URL - use in the Grafana provider (var.grafana_url)"
}
