locals {
  zone_id = aws_route53_zone.main.zone_id

  # Construct the base domain for certificates and records
  base_domain = var.use_environment_prefix ? "${var.environment}.${var.domain_name}" : var.domain_name
}

# Route53 Hosted Zone - DNS management for the domain
resource "aws_route53_zone" "main" {
  name = local.base_domain

  tags = merge(
    {
      Name        = local.base_domain
      Environment = var.environment
    },
    var.tags
  )
}

provider "aws" {
  alias  = "us_east_1_for_cloudfront"
  region = "us-east-1"
}

# ACM Certificate for SSL/TLS encryption (Regional - for ALB and other regional services)
resource "aws_acm_certificate" "regional_services_cert" {
  domain_name       = "api.${local.base_domain}" # Primary domain for this cert
  validation_method = "DNS"

  # Only include SANs that regional services (like ALB) would directly serve.
  # If other domains (like root env domain or docs) are only via CloudFront,
  # they don't need to be on this regional cert.
  subject_alternative_names = [
    # Potentially other regional-specific subdomains if needed in the future.
    # For now, focused on what the ALB needs.
    # If var.domain_name itself or other subdomains are needed by regional services, add them here.
    # Example: If you had a regional API Gateway for "internal.env.domain.com"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(
    {
      Name        = "regional-services-${var.environment}-certificate"
      Environment = var.environment
    },
    var.tags
  )
}

# DNS validation records for the regional services certificate
resource "aws_route53_record" "regional_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.regional_services_cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = local.zone_id
}

# Certificate validation for the regional services certificate
resource "aws_acm_certificate_validation" "regional_services_cert" {
  certificate_arn         = aws_acm_certificate.regional_services_cert.arn
  validation_record_fqdns = [for record in aws_route53_record.regional_cert_validation : record.fqdn]

  timeouts {
    create = "5m"
  }
}

# ACM Certificates for CloudFront (us-east-1)
resource "aws_acm_certificate" "cloudfront_certs" {
  for_each = var.cloudfront_domain_configs

  provider          = aws.us_east_1_for_cloudfront
  domain_name       = each.value # each.value is the FQDN from the map
  subject_alternative_names = each.key ==  "web" ? [ "www.${local.base_domain}"] : null
  validation_method = "DNS"

  tags = merge(
    {
      Name        = "${each.key}-cloudfront-certificate" # Use the map key for a descriptive name
      Environment = var.environment
      Service     = "CloudFront"
    },
    var.tags
  )

  lifecycle {
    create_before_destroy = true
  }
}

# DNS validation records for the CloudFront (us-east-1) certificates
resource "aws_route53_record" "cloudfront_cert_validation" {
  # Iterate over each certificate created for CloudFront
  for_each = aws_acm_certificate.cloudfront_certs

  allow_overwrite = true
  # Assuming one validation option per certificate, which is typical for DNS validation.
  # Convert the set to a list to access the first element.
  name    = tolist(each.value.domain_validation_options)[0].resource_record_name
  records = [tolist(each.value.domain_validation_options)[0].resource_record_value]
  ttl     = 60
  type    = tolist(each.value.domain_validation_options)[0].resource_record_type
  zone_id = local.zone_id # Corrected to use the simplified local.zone_id
}

resource "aws_route53_record" "cloudfront_cert_validation_san" {
  for_each = {
    for k, v in aws_acm_certificate.cloudfront_certs :
    k => v if length(v.domain_validation_options) > 1
  }

  allow_overwrite = true
  name    = tolist(each.value.domain_validation_options)[1].resource_record_name
  records = [tolist(each.value.domain_validation_options)[1].resource_record_value]
  ttl     = 60
  type    = tolist(each.value.domain_validation_options)[1].resource_record_type
  zone_id = local.zone_id
}

# Certificate validation for the CloudFront (us-east-1) certificates
resource "aws_acm_certificate_validation" "cloudfront_certs_validation" {
  provider = aws.us_east_1_for_cloudfront
  # Iterate over each certificate created for CloudFront
  for_each = aws_acm_certificate.cloudfront_certs

  certificate_arn = each.value.arn
  # Construct the FQDN for the validation record based on the for_each key
  validation_record_fqdns = compact([
    aws_route53_record.cloudfront_cert_validation[each.key].fqdn,
    try(aws_route53_record.cloudfront_cert_validation_san[each.key].fqdn, null)
  ])

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [aws_route53_record.cloudfront_cert_validation]
}


# Create records for CloudFront distributions (docs, root domain)
resource "aws_route53_record" "cloudfront_record" {
  for_each = var.cloudfront_records

  zone_id = local.zone_id
  # If the key is empty (""), we're setting up the root domain for the environment
  # Otherwise, we're setting up a subdomain
  name = each.key == "" ? local.base_domain : "${each.key}.${local.base_domain}"
  type = "A"

  alias {
    name                   = each.value.domain_name
    zone_id                = each.value.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www_cname" {
zone_id = local.zone_id
name = "www.${local.base_domain}"
type = "CNAME"
ttl = 300
records = [local.base_domain]
}