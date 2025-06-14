# Route53 module for handling DNS resources

# Route53 Hosted Zone - DNS management for the domain
# Only created if you don't have an existing hosted zone for the domain
resource "aws_route53_zone" "main" {
  count = var.create_route53_zone ? 1 : 0
  name  = var.domain_name

  tags = merge(
    {
      Name        = var.domain_name
      Environment = var.environment
    },
    var.tags
  )
}

# Local values for DNS configurations
locals {
  zone_id = var.create_route53_zone ? aws_route53_zone.main[0].zone_id : var.route53_zone_id
}

# ACM Certificate for SSL/TLS encryption
# DNS validation is preferred over email validation for automation
# Wildcard certificate (*.domain.com) allows multiple subdomains without additional certificates
resource "aws_acm_certificate" "main_cert" {
  count             = var.create_certificate ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  # Add wildcard and specific subdomains
  subject_alternative_names = concat(
    ["*.${var.domain_name}"],
    [for env in var.environments : "${env}.${var.domain_name}"],
    [for env in var.environments : "api.${env}.${var.domain_name}"],
    [for env in var.environments : "docs.${env}.${var.domain_name}"]
  )

  # Ensures certificate is created before old one is destroyed during updates
  # Prevents downtime during certificate renewals
  lifecycle {
    create_before_destroy = true
  }

  tags = merge(
    {
      Name        = "${var.domain_name}-certificate"
      Environment = var.environment
    },
    var.tags
  )
}

# DNS validation records for automatic certificate validation
# ACM requires DNS records to prove domain ownership
# for_each creates one record per domain in the certificate (main + SANs)
resource "aws_route53_record" "cert_validation" {
  for_each = var.create_certificate ? {
    for dvo in aws_acm_certificate.main_cert[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true # Prevents conflicts if records already exist
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60 # Short TTL for faster propagation during validation
  type            = each.value.type
  zone_id         = local.zone_id
}

# Certificate validation waits for DNS propagation and ACM validation
# This resource blocks until the certificate is fully validated and ready to use
resource "aws_acm_certificate_validation" "main_cert" {
  count                   = var.create_certificate ? 1 : 0
  certificate_arn         = aws_acm_certificate.main_cert[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "5m" # Timeout if validation takes longer than 5 minutes
  }
}

# Create API record pointing to ALB when alb_dns_name is provided
resource "aws_route53_record" "api_record" {
  for_each = var.alb_records

  zone_id = local.zone_id
  name    = "${each.key}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = each.value.dns_name
    zone_id                = each.value.zone_id
    evaluate_target_health = true
  }
}

# Create records for CloudFront distributions (docs, root domain)
resource "aws_route53_record" "cloudfront_record" {
  for_each = var.cloudfront_records

  zone_id = local.zone_id
  name    = "${each.key}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = each.value.domain_name
    zone_id                = each.value.hosted_zone_id
    evaluate_target_health = false
  }
}
