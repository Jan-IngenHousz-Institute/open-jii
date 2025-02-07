output "cloudfront_distribution_domain_name" {
  description = "The domain name assigned to the CloudFront distribution."
  value       = aws_cloudfront_distribution.cdn.domain_name
}