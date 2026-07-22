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

# Optional viewer-request function: legacy 301 redirect map + clean-URL rewrite
# to static-export .html objects. Enabled per-distribution via a variable so
# other module consumers keep the default (no function) behavior.
resource "aws_cloudfront_function" "redirects" {
  count   = var.enable_redirect_function ? 1 : 0
  name    = "${var.bucket_name}-redirects"
  runtime = "cloudfront-js-2.0"
  comment = "Legacy redirect map + clean-URL rewrite for ${var.bucket_name}"
  publish = true
  code = templatefile("${path.module}/redirect-function.js.tftpl", {
    redirect_map_json = jsonencode(var.redirect_map)
  })
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

    # Attach the redirect/rewrite function on the viewer-request event when enabled.
    dynamic "function_association" {
      for_each = var.enable_redirect_function ? [1] : []
      content {
        event_type   = "viewer-request"
        function_arn = aws_cloudfront_function.redirects[0].arn
      }
    }
  }

  # SPA/client-side-routing behavior: map missing keys to /index.html with 200.
  # Kept as the default so existing module consumers are unaffected.
  dynamic "custom_error_response" {
    for_each = var.enable_spa_error_response ? [403, 404] : []
    content {
      error_code            = custom_error_response.value
      response_code         = 200
      response_page_path    = "/index.html"
      error_caching_min_ttl = 10
    }
  }

  # Real 404 for statically-exported sites: S3 OAC returns 403 for missing keys,
  # so map both 403 and 404 to the exported 404.html served with HTTP 404.
  dynamic "custom_error_response" {
    for_each = var.enable_spa_error_response ? [] : [403, 404]
    content {
      error_code            = custom_error_response.value
      response_code         = 404
      response_page_path    = "/404.html"
      error_caching_min_ttl = 10
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
