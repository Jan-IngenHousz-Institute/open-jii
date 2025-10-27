# Route53 module outputs

output "route53_zone_id" {
  description = "Route53 zone ID"
  value       = local.zone_id
}

output "domain_name" {
  description = "Domain name"
  value       = var.domain_name
}

output "regional_services_certificate_arn" {
  description = "ARN of the ACM certificate for regional services (e.g., ALB)"
  value       = aws_acm_certificate.regional_services_cert.arn
}

output "name_servers" {
  description = "Name servers for the Route53 zone"
  value       = aws_route53_zone.main.name_servers
}

output "environment_domain" {
  description = "Environment domain name"
  value       = local.base_domain
}

output "api_domain" {
  description = "API domain name for environment"
  value       = "api.${local.base_domain}"
}

output "docs_domain" {
  description = "Docs domain name for environment"
  value       = "docs.${local.base_domain}"
}

output "cloudfront_certificate_arns" {
  description = "A map of CloudFront domain logical names to their ACM certificate ARNs in us-east-1."
  value = {
    for key, cert in aws_acm_certificate.cloudfront_certs : key => cert.arn
  }
}
