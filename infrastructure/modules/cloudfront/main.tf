resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "${var.bucket_name}-cloudfront-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Local values for conditional domain configuration
locals {
  has_custom_domain = var.custom_domain != "" && var.certificate_arn != ""
}

resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = format("%s.s3.%s.amazonaws.com", var.bucket_name, var.aws_region)
    origin_id   = "S3-${var.bucket_name}"

    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  enabled             = true
  default_root_object = var.default_root_object

  # Set aliases for custom domain if provided
  aliases = local.has_custom_domain ? [var.custom_domain] : []

  default_cache_behavior {
    target_origin_id       = "S3-${var.bucket_name}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # Use custom certificate if custom domain is provided, otherwise use default CloudFront certificate
    acm_certificate_arn            = local.has_custom_domain ? var.certificate_arn : null
    ssl_support_method             = local.has_custom_domain ? "sni-only" : null
    minimum_protocol_version       = local.has_custom_domain ? "TLSv1.2_2021" : null
    cloudfront_default_certificate = !local.has_custom_domain
  }

  price_class = "PriceClass_100"
  web_acl_id  = var.waf_acl_id
}
