# Route53 module outputs

output "route53_zone_id" {
  description = "Route53 zone ID"
  value       = local.zone_id
}

output "domain_name" {
  description = "Domain name"
  value       = var.domain_name
}

output "certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = var.create_certificate ? aws_acm_certificate.main_cert[0].arn : ""
}

output "name_servers" {
  description = "Name servers for the Route53 zone"
  value       = aws_route53_zone.main.name_servers
}

output "environment_domain" {
  description = "Environment domain name"
  value       = "${var.environment}.${var.domain_name}"
}

output "api_domain" {
  description = "API domain name for environment"
  value       = "api.${var.environment}.${var.domain_name}"
}

output "docs_domain" {
  description = "Docs domain name for environment"
  value       = "docs.${var.environment}.${var.domain_name}"
}
