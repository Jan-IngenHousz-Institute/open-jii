provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# Bundle a small Lambda@Edge that hashes POST bodies
# to set the x-amz-content-sha256 header for S3 uploads.
# https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html
data "archive_file" "edge_hash_body" {
  type        = "zip"
  output_path = "${path.module}/edge_hash_body.zip"

  source {
    filename = "index.js"
    content  = <<-EOF
const { createHash } = require('crypto');

exports.handler = async (event) => {
  const { request } = event.Records[0].cf;

  try {
    if (["POST","PUT","PATCH"].includes(request.method)) {
      const body = Buffer.from(request.body.data, request.body.encoding);
      const hash = createHash("sha256").update(body).digest("hex");
      request.headers["x-amz-content-sha256"] = [{ key:"x-amz-content-sha256", value:hash }];
      console.log('  computed hash:', hash);
    }
    return request;
  } catch (err) {
    console.error('edge_hash_body error:', err);
    throw err;
  }
};
    EOF
  }
}

# Role for the edge function
resource "aws_iam_role" "edge_hash_body" {
  provider = aws.us_east_1
  name     = "${var.project_name}-edge-hash-body-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = ["lambda.amazonaws.com", "edgelambda.amazonaws.com"] }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "edge_hash_body_attach" {
  provider   = aws.us_east_1
  role       = aws_iam_role.edge_hash_body.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# The Lambda@Edge function itself
resource "aws_lambda_function" "edge_hash_body" {
  provider         = aws.us_east_1
  filename         = data.archive_file.edge_hash_body.output_path
  source_code_hash = data.archive_file.edge_hash_body.output_base64sha256
  function_name    = "${var.project_name}-edge-hash-body"
  role             = aws_iam_role.edge_hash_body.arn
  handler          = "index.handler"
  runtime          = "nodejs22.x"
  publish          = true

  lifecycle {
    ignore_changes = [
      source_code_hash,
      filename
    ]
  }
}

# Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "s3_oac" {
  name                              = "${var.project_name}-s3-oac"
  description                       = "Origin Access Control for ${var.project_name} S3 assets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# OAC for Lambda Function URLs
resource "aws_cloudfront_origin_access_control" "lambda_oac" {
  name                              = "${var.project_name}-lambda-oac"
  description                       = "SigV4 OAC for ${var.project_name} Lambda Function URLs"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

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
  enabled         = true
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
    origin_id                = "ServerLambda"
    domain_name              = var.server_function_url_domain
    origin_access_control_id = aws_cloudfront_origin_access_control.lambda_oac.id

    custom_origin_config {
      http_port              = 443
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Image optimization Lambda origin
  origin {
    origin_id                = "ImageLambda"
    domain_name              = var.image_function_url_domain
    origin_access_control_id = aws_cloudfront_origin_access_control.lambda_oac.id

    custom_origin_config {
      http_port              = 443
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Default cache behavior - route to Server Lambda for all dynamic routes (SSR)
  default_cache_behavior {
    target_origin_id       = "ServerLambda"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingOptimized
    origin_request_policy_id = aws_cloudfront_origin_request_policy.lambda_signed_requests.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.forward_host_header.arn
    }
  }

  # Cache behavior for Next.js static assets (hashed files)
  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    target_origin_id       = "S3Assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimizedForUncompressedObjects
  }

  # Cache behavior for image optimization
  ordered_cache_behavior {
    path_pattern           = "/_next/image"
    target_origin_id       = "ImageLambda"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = "b2884449-e4de-46a7-ac36-70bc7f1ddd6d" # Managed-CachingOptimized
    origin_request_policy_id = aws_cloudfront_origin_request_policy.lambda_signed_requests.id
  }

  ordered_cache_behavior {
    path_pattern           = "/*/login"
    target_origin_id       = "ServerLambda"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingOptimized
    origin_request_policy_id = aws_cloudfront_origin_request_policy.lambda_signed_requests.id

    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = aws_lambda_function.edge_hash_body.qualified_arn
      include_body = true
    }

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.forward_host_header.arn
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/*/platform/signout"
    target_origin_id       = "ServerLambda"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingOptimized
    origin_request_policy_id = aws_cloudfront_origin_request_policy.lambda_signed_requests.id

    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = aws_lambda_function.edge_hash_body.qualified_arn
      include_body = true
    }

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.forward_host_header.arn
    }
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
    origin_request_policy_id = aws_cloudfront_origin_request_policy.lambda_signed_requests.id

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
    origin_request_policy_id = aws_cloudfront_origin_request_policy.lambda_signed_requests.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.forward_host_header.arn
    }
  }

  # Cache behavior for SVG files in the root directory
  ordered_cache_behavior {
    path_pattern           = "*.svg"
    target_origin_id       = "S3Assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimizedForUncompressedObjects
  }

  # Cache behavior for ICO files in the root directory
  ordered_cache_behavior {
    path_pattern           = "*.ico"
    target_origin_id       = "S3Assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimizedForUncompressedObjects
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

# Origin Request Policy for Lambda signed requests
resource "aws_cloudfront_origin_request_policy" "lambda_signed_requests" {
  name    = "${var.project_name}-lambda-signed-requests"
  comment = "Policy to forward necessary headers and cookies for signed Lambda requests"
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = [
        "x-forwarded-host",       # Essential for routing
        "next-action",            # Required for server actions
        "next-router-state-tree", # Required for RSC navigation
        "next-router-prefetch",   # Required for prefetching
        "rsc",                    # Essential RSC marker
        "content-type",           # Required for content negotiation
        "x-prerender-revalidate", # Needed for revalidation
        "referer",                # Important for auth flows
        "x-action-redirect",      # Needed for redirects in server actions
        "origin"                  # Required for CORS
      ]
    }
  }
  cookies_config {
    cookie_behavior = "all"
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}
