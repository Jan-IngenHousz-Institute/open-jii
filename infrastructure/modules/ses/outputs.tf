# SES module outputs

output "domain_identity_arn" {
  description = "ARN of the SES domain identity"
  value       = aws_ses_domain_identity.main.arn
}

output "smtp_user_name" {
  description = "IAM user whose access key signs in to SES SMTP"
  value       = var.create_smtp_user ? aws_iam_user.ses_smtp[0].name : null
}

output "smtp_server" {
  description = "SES SMTP server endpoint"
  value       = "email-smtp.${var.region}.amazonaws.com"
}

output "from_domain" {
  description = "The configured from domain"
  value       = local.from_domain
}

output "configuration_set_name" {
  description = "Name of the SES configuration set"
  value       = aws_ses_configuration_set.main.name
}
