# ALB Module

Creates an Application Load Balancer for the backend API, sitting behind CloudFront.

## What It Creates

- **Application Load Balancer** with idle timeout and optional access logging
- **Target Group** with configurable health checks (ECS tasks register here)
- **HTTP Listener** — redirects all traffic to HTTPS (301)
- **HTTPS Listener** — terminates TLS using the provided ACM certificate
- **Listener Rule** — verifies a custom CloudFront header to block direct ALB access

Deletion protection is automatically enabled in `prod`.

## Usage

```hcl
module "alb" {
  source = "../../modules/alb"

  service_name      = "my-api"
  environment       = "prod"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  security_groups   = [module.vpc.alb_security_group_id]
  certificate_arn   = module.acm.certificate_arn
  container_port    = 3000

  cloudfront_header_name  = "X-Custom-Header"
  cloudfront_header_value = "secret-value"

  enable_access_logs = true
  access_logs_bucket = module.logs_bucket.bucket_id
}
```

## Inputs

| Name | Description | Default |
|------|-------------|---------|
| `service_name` | Name prefix for all resources | — |
| `environment` | Environment name (`dev`, `prod`) | — |
| `vpc_id` | VPC ID for the target group | — |
| `public_subnet_ids` | Subnets for the ALB | — |
| `security_groups` | Security groups attached to the ALB | — |
| `certificate_arn` | ACM certificate ARN for HTTPS | — |
| `container_port` | Port the backend container listens on | — |
| `idle_timeout` | Idle timeout in seconds | `60` |
| `cloudfront_header_name` | Custom header name for origin verification | — |
| `cloudfront_header_value` | Custom header value for origin verification | — |
| `enable_access_logs` | Enable ALB access logging | `false` |
| `access_logs_bucket` | S3 bucket for access logs | `""` |
| `health_check_*` | Health check path, interval, thresholds, timeout | see variables.tf |

## Outputs

| Name | Description |
|------|-------------|
| `alb_arn` | ARN of the ALB |
| `target_group_arn` | ARN of the target group (used by ECS) |
| `alb_dns_name` | DNS name for CloudFront/Route53 origin |
| `alb_zone_id` | Hosted zone ID for Route53 alias records |
