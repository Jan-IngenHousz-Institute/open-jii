# SES module outputs

output "domain_identity_arn" {
  description = "ARN of the SES domain identity"
  value       = aws_ses_domain_identity.main.arn
}

output "smtp_username" {
  description = "SMTP username (IAM access key ID)"
  value       = var.create_smtp_user ? aws_iam_access_key.ses_smtp[0].id : null
  sensitive   = false
}

output "smtp_password" {
  description = "SMTP password (IAM secret access key)"
  value       = var.create_smtp_user ? aws_iam_access_key.ses_smtp[0].ses_smtp_password_v4 : null
  sensitive   = true
}

output "smtp_server" {
  description = "SES SMTP server endpoint"
  value       = "email-smtp.${var.region}.amazonaws.com"
}

output "auth_email_server" {
  description = "Complete AUTH_EMAIL_SERVER string for Auth.js"
  value       = var.create_smtp_user ? "smtp://${aws_iam_access_key.ses_smtp[0].id}:${aws_iam_access_key.ses_smtp[0].ses_smtp_password_v4}@email-smtp.${var.region}.amazonaws.com:587" : null
  sensitive   = true
}

output "from_domain" {
  description = "The configured from domain"
  value       = local.from_domain
}

output "configuration_set_name" {
  description = "Name of the SES configuration set"
  value       = aws_ses_configuration_set.main.name
}
