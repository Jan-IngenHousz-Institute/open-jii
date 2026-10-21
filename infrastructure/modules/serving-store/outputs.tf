output "host" {
  description = "Private address of the store, stable across instance replacements"
  value       = aws_instance.store.private_ip
}

output "url" {
  description = "HTTP endpoint of the store"
  value       = "http://${aws_instance.store.private_ip}:${var.http_port}"
}

output "credentials_secret_arns" {
  description = "Secrets Manager secret per role (admin, writer, reader), each holding username and password"
  value       = { for role, credentials in module.credentials : role => credentials.secret_arn }
  sensitive   = true
}
