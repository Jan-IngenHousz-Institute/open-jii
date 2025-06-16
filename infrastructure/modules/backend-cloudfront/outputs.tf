output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.api_distribution.id
}

output "cloudfront_distribution_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.api_distribution.domain_name
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.api_distribution.arn
}


output "cloudfront_hosted_zone_id" {
  description = "The hosted zone ID for the CloudFront distribution (always Z2FDTNDATAQYW2 for CloudFront)"
  value       = aws_cloudfront_distribution.api_distribution.hosted_zone_id
}
