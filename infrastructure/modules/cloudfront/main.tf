resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = var.s3_bucket_rest_endpoint // e.g., "my-bucket.s3.us-east-1.amazonaws.com"
    origin_id   = "S3-${var.bucket_name}"

    s3_origin_config {
      // Use the OAI passed in from the root module.
      origin_access_identity = var.oai_access_identity
    }
  }

  enabled             = true
  default_root_object = var.default_root_object

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
    cloudfront_default_certificate = true
  }
}