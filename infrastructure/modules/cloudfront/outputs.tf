output "cloudfront_distribution_domain_name" {
  description = "The domain name assigned to the CloudFront distribution"
  value       = aws_cloudfront_distribution.cdn.domain_name
}

output "cloudfront_distribution_arn" {
  description = "The ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.cdn.arn
}

output "cloudfront_hosted_zone_id" {
  description = "The CloudFront Route 53 zone ID for aliasing custom domains"
  value       = aws_cloudfront_distribution.cdn.hosted_zone_id
}

output "custom_domain" {
  description = "The custom domain for the CloudFront distribution (if configured)"
  value       = local.has_custom_domain ? var.custom_domain : ""
}

output "distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.cdn.id
}