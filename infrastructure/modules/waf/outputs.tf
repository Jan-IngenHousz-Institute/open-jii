output "web_acl_id" {
  description = "ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.id
}

output "log_group_name" {
  description = "Name of the CloudWatch log group for WAF logs"
  value       = aws_cloudwatch_log_group.waf_logs.name
}

output "cloudfront_web_acl_arn" {
  description = "ARN of the CloudFront WAF Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}
