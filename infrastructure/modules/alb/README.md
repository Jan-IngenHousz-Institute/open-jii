# ALB Module

Creates an Application Load Balancer for the backend API, sitting behind CloudFront. It has two
shapes, chosen by `internal`.

**Internal** (`internal = true`): the ALB sits in private subnets and has no public address.
CloudFront reaches it through a CloudFront VPC origin, which this module creates. Nothing outside
the VPC can reach it, so no shared header is needed.

**Internet-facing** (the default): the ALB sits in public subnets and forwards only requests that
carry the custom header CloudFront adds. Only `env/dr` still uses this shape; dev and prod are internal.

## What It Creates

- **Application Load Balancer** with idle timeout and optional access logging
- **Target Group** with configurable health checks (ECS tasks register here)
- **HTTPS Listener**, which terminates TLS using the provided ACM certificate. When internal, it
  forwards everything to the target group. When internet-facing, it answers 403 by default.
- **CloudFront VPC origin**, internal only. Creating it takes up to 15 minutes.
- **HTTP Listener**, internet-facing only, which redirects all traffic to HTTPS (301)
- **Listener Rule**, internet-facing only, which forwards requests carrying the CloudFront header

The security group passed in must admit HTTPS from CloudFront. The shared ALB security group in the
VPC module admits the `com.amazonaws.global.cloudfront.origin-facing` prefix list, which is what
AWS documents for an IPv4 VPC origin as well.

Deletion protection is on in `prod` and off elsewhere. `deletion_protection` overrides it, as for
an ALB about to be removed.

## Usage

```hcl
module "alb" {
  source = "../../modules/alb"

  service_name    = "my-api"
  environment     = "prod"
  internal        = true
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets
  security_groups = [module.vpc.alb_security_group_id]
  certificate_arn = module.acm.certificate_arn
  container_port  = 3000

  enable_access_logs = true
  access_logs_bucket = module.logs_bucket.bucket_id
}
```

An internet-facing ALB takes public subnets and sets `cloudfront_header_value` instead of
`internal`.

## Inputs

| Name                      | Description                                                   | Default             |
| ------------------------- | ------------------------------------------------------------- | ------------------- |
| `service_name`            | Name prefix for all resources                                 | —                   |
| `environment`             | Environment name (`dev`, `prod`)                              | `"Dev"`             |
| `internal`                | Private subnets, no public address, reached by a VPC origin   | `false`             |
| `vpc_id`                  | VPC ID for the target group                                   | —                   |
| `subnet_ids`              | Private subnets when internal, public subnets otherwise       | —                   |
| `security_groups`         | Security groups attached to the ALB                           | —                   |
| `certificate_arn`         | ACM certificate ARN for HTTPS                                 | `""`                |
| `container_port`          | Port the backend container listens on                         | —                   |
| `deletion_protection`     | Overrides deletion protection (on in prod only by default)    | `null`              |
| `idle_timeout`            | Idle timeout in seconds                                       | `60`                |
| `cloudfront_header_name`  | Custom header name for origin verification (internet-facing)  | `"X-Origin-Verify"` |
| `cloudfront_header_value` | Custom header value for origin verification (internet-facing) | `null`              |
| `enable_access_logs`      | Enable ALB access logging                                     | `false`             |
| `access_logs_bucket`      | S3 bucket for access logs                                     | `""`                |
| `health_check_*`          | Health check path, interval, thresholds, timeout              | see variables.tf    |

## Outputs

| Name               | Description                                   |
| ------------------ | --------------------------------------------- |
| `alb_arn`          | ARN of the ALB                                |
| `target_group_arn` | ARN of the target group (used by ECS)         |
| `alb_dns_name`     | DNS name for the CloudFront origin            |
| `alb_zone_id`      | Hosted zone ID for Route53 alias records      |
| `vpc_origin_id`    | ID of the CloudFront VPC origin when internal |
