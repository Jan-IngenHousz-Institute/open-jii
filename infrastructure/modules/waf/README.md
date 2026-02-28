# WAF Module

Creates a WAFv2 Web ACL for CloudFront distributions with common security rules.

## What it does

- AWS Managed Rules: Common Rule Set + Known Bad Inputs
- Optional Bot Control rule set (opt-in, adds ~$10/month)
- IP-based rate limiting (configurable requests per 5-minute window)
- Optional geo-blocking by country code
- Large body bypass for specific routes (e.g., file upload endpoints)
- CloudWatch logging with configurable retention

## Usage

```hcl
module "backend_waf" {
  source = "../../modules/waf"

  service_name       = "backend"
  environment        = var.environment
  rate_limit         = 500
  log_retention_days = 30
  enable_bot_control = true

  large_body_bypass_routes = [
    {
      search_string         = "/upload"
      positional_constraint = "ENDS_WITH"
      method                = "POST"
    }
  ]

  tags = {
    Environment = var.environment
    Project     = "my-project"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `service_name` | Base name for the service | `string` | — | yes |
| `environment` | Environment name | `string` | — | yes |
| `rate_limit` | Requests per 5-min window per IP | `number` | `500` | no |
| `blocked_countries` | ISO 3166-1 alpha-2 country codes to block | `list(string)` | `[]` | no |
| `log_retention_days` | Days to retain WAF logs | `number` | `30` | no |
| `enable_bot_control` | Enable AWS Bot Control rule set | `bool` | `false` | no |
| `bot_control_inspection_level` | `COMMON` or `TARGETED` | `string` | `COMMON` | no |
| `large_body_bypass_routes` | Routes that bypass body size restrictions | `list(object)` | `[]` | no |
| `tags` | Tags to apply to resources | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `web_acl_id` | ID of the WAF Web ACL |
| `cloudfront_web_acl_arn` | ARN of the WAF Web ACL (use for CloudFront `web_acl_id`) |
| `log_group_name` | CloudWatch log group name for WAF logs |
