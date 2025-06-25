# Backend API CloudFront Distribution
# Secures ALB by placing CloudFront in front, restricting direct access

resource "aws_cloudfront_distribution" "api_distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "API Distribution for ${var.service_name}-${var.environment}"
  default_root_object = ""
  price_class         = var.price_class
  http_version        = "http2and3" # Enable HTTP/2 and HTTP/3 for better performance

  # ALB Origin
  origin {
    domain_name = var.alb_domain_name
    origin_id   = "alb-${var.service_name}-${var.environment}"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 5
    }

    # TODO: move to ssm
    custom_header {
      name  = var.custom_header_name
      value = var.custom_header_value # This value is passed to CF to set in requests to origin
    }
  }

  # Default cache behavior
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "alb-${var.service_name}-${var.environment}" # Corrected to match origin_id
    viewer_protocol_policy = "redirect-to-https"                          # Force HTTPS for all clients

    # Cache settings - minimal for API
    min_ttl     = 0
    default_ttl = var.default_ttl # Short caching for APIs, can be 0
    max_ttl     = var.max_ttl     # Maximum cache duration, can be low for APIs

    # Forward all headers, cookies, and query strings to origin for APIs
    forwarded_values {
      query_string = true
      headers      = var.forwarded_headers

      cookies {
        forward = "all" # Forward all cookies to origin
      }
    }
  }

  # Custom domain configuration
  aliases = var.custom_domain != "" ? [var.custom_domain] : []

  # Geographic restriction (optional)
  restrictions {
    geo_restriction {
      restriction_type = length(var.blocked_countries) > 0 ? "blacklist" : "none"
      locations        = var.blocked_countries
    }
  }

  # SSL/TLS certificate configuration
  viewer_certificate {
    acm_certificate_arn            = var.certificate_arn != "" ? var.certificate_arn : null
    ssl_support_method             = var.certificate_arn != "" ? "sni-only" : null
    minimum_protocol_version       = "TLSv1.2_2021" # Latest TLS version for enhanced security
    cloudfront_default_certificate = var.certificate_arn == "" ? true : false
  }

  # Web Application Firewall integration
  web_acl_id = var.waf_acl_id

  # Access logging to S3
  dynamic "logging_config" {
    for_each = var.enable_logging && var.log_bucket != "" ? [1] : []
    content {
      include_cookies = true
      bucket          = "${var.log_bucket}.s3.amazonaws.com"
      prefix          = "cloudfront-logs/${var.service_name}-${var.environment}"
    }
  }

  tags = merge(
    {
      Name        = "${var.service_name}-cloudfront-${var.environment}"
      Environment = var.environment
      Service     = var.service_name
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}
