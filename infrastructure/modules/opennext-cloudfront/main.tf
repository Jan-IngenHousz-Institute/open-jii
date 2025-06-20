# Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "${var.project_name}-s3-oac"
  description                       = "Origin Access Control for ${var.project_name} S3 assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Function for header forwarding
resource "aws_cloudfront_function" "forward_host_header" {
  name    = "${var.project_name}-forward-host-header"
  runtime = "cloudfront-js-1.0"
  comment = "Forward host header as x-forwarded-host for OpenNext"
  publish = true
  code    = <<-EOT
function handler(event) {
  var request = event.request;
  var headers = request.headers;
  
  // Forward the host header as x-forwarded-host
  if (headers.host) {
    headers['x-forwarded-host'] = headers.host;
  }
  
  return request;
}
EOT
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "distribution" {
  enabled         = false
  is_ipv6_enabled = true
  price_class     = var.price_class
  aliases         = var.aliases
  web_acl_id      = var.waf_acl_id
  tags            = var.tags

  # Access logging to S3
  dynamic "logging_config" {
    for_each = var.enable_logging && var.log_bucket != "" ? [1] : []
    content {
      include_cookies = true
      bucket          = "${var.log_bucket}.s3.amazonaws.com"
      prefix          = "cloudfront-logs/opennext"
    }
  }

  # S3 origin for static assets
  origin {
    origin_id                = "S3Assets"
    domain_name              = var.assets_bucket_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.s3_oac.id
  }

  # Server Lambda origin for SSR/API
  origin {
    origin_id   = "ServerLambda"
    domain_name = var.server_function_url_domain

    custom_origin_config {
      http_port              = 443
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Image optimization Lambda origin
  origin {
    origin_id   = "ImageLambda"
    domain_name = var.image_function_url_domain

    custom_origin_config {
      http_port              = 443
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default cache behavior - route to S3 assets
  default_cache_behavior {
    target_origin_id       = "S3Assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingOptimized

    # No origin request policy needed for S3 static assets
  }

  # Cache behavior for Next.js static assets (hashed files)
  ordered_cache_behavior {
    path_pattern           = "_next/static/*"
    target_origin_id       = "S3Assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimizedForUncompressedObjects
  }

  # Cache behavior for image optimization
  ordered_cache_behavior {
    path_pattern           = "_next/image*"
    target_origin_id       = "ImageLambda"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # Managed-CORS-S3Origin
  }

  # Cache behavior for API routes
  ordered_cache_behavior {
    path_pattern           = "api/*"
    target_origin_id       = "ServerLambda"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # Managed-CORS-S3Origin

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.forward_host_header.arn
    }
  }

  # Cache behavior for Next.js data requests
  ordered_cache_behavior {
    path_pattern           = "_next/data/*"
    target_origin_id       = "ServerLambda"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # Managed-CORS-S3Origin

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.forward_host_header.arn
    }
  }

  # Cache behavior for all other dynamic routes (SSR)
  ordered_cache_behavior {
    path_pattern           = "*"
    target_origin_id       = "ServerLambda"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # Managed-CORS-S3Origin

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.forward_host_header.arn
    }
  }

  # SSL certificate configuration
  viewer_certificate {
    acm_certificate_arn            = var.acm_certificate_arn
    cloudfront_default_certificate = var.acm_certificate_arn == null
    ssl_support_method             = var.acm_certificate_arn != null ? "sni-only" : null
    minimum_protocol_version       = var.acm_certificate_arn != null ? "TLSv1.2_2021" : null
  }

  # Error pages
  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  custom_error_response {
    error_code         = 500
    response_code      = 500
    response_page_path = "/500.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}
