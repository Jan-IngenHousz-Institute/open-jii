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
  description = "Name servers for the Route53 zone (if created)"
  value       = var.create_route53_zone ? aws_route53_zone.main[0].name_servers : []
}

output "environment_domains" {
  description = "Map of environment domain names"
  value = {
    for env in var.environments : env => "${env}.${var.domain_name}"
  }
}

output "api_domains" {
  description = "Map of API domain names for each environment"
  value = {
    for env in var.environments : env => "api.${env}.${var.domain_name}"
  }
}

output "docs_domains" {
  description = "Map of docs domain names for each environment"
  value = {
    for env in var.environments : env => "docs.${env}.${var.domain_name}"
  }
}
