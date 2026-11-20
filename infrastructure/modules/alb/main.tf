# Application Load Balancer - Layer 7 load balancer with advanced routing
#
# Two shapes, chosen by var.internal:
# - internal: in private subnets with no public address. CloudFront reaches it through a VPC
#   origin, so no shared header is needed.
# - internet-facing: in public subnets, forwarding only requests that carry the custom header
#   CloudFront adds. Kept until every environment has moved to the internal shape.

# An internet-facing instance is fronted by CloudFront + WAF and header-verified.
#trivy:ignore:AVD-AWS-0053
resource "aws_lb" "app_alb" {
  name               = "${var.service_name}-alb"
  internal           = var.internal
  load_balancer_type = "application"
  security_groups    = var.security_groups
  subnets            = var.subnet_ids
  # Idle timeout balances connection efficiency vs resource usage
  # 60s default is good for APIs; increase for long-running connections
  idle_timeout = var.idle_timeout

  # Strip malformed/non-conforming HTTP headers before they reach the target,
  # reducing request-smuggling surface.
  drop_invalid_header_fields = true

  # Deletion protection prevents accidental ALB deletion in production
  # Disabled in dev/staging for easier teardown
  enable_deletion_protection = var.deletion_protection != null ? var.deletion_protection : var.environment == "prod"

  # Access logs provide detailed request-level logging for debugging and analytics
  dynamic "access_logs" {
    for_each = var.enable_access_logs && var.access_logs_bucket != "" ? [1] : []
    content {
      bucket  = var.access_logs_bucket
      prefix  = "${var.service_name}-alb-logs"
      enabled = true
    }
  }

  # Add tags for cost tracking
  tags = merge(
    {
      Name        = "${var.service_name}-alb"
      Environment = var.environment
      Service     = var.service_name
    },
    var.tags
  )
}

# Target Group - defines the backend services that ALB forwards traffic to
# target_type = "ip" is required for Fargate (vs "instance" for EC2)
resource "aws_lb_target_group" "app_tg" {
  name        = "${var.service_name}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip" # Required for ECS Fargate tasks
  vpc_id      = var.vpc_id

  # Health check configuration determines when targets are ready to receive traffic
  # These settings should align with your application's startup time and health endpoint
  health_check {
    enabled             = true
    path                = var.health_check_path
    port                = "traffic-port"                       # Use same port as traffic
    healthy_threshold   = var.health_check_healthy_threshold   # Consecutive successes to mark healthy
    unhealthy_threshold = var.health_check_unhealthy_threshold # Consecutive failures to mark unhealthy
    timeout             = var.health_check_timeout             # Time to wait for response
    interval            = var.health_check_interval            # Time between checks
    matcher             = var.health_check_matcher             # HTTP status codes considered healthy
  }

  # Session stickiness - disabled by default for stateless applications
  # Enable only if your application maintains server-side session state
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400 # 24 hours
    enabled         = false # Disabled for stateless apps
  }
}

# HTTP Listener - always redirects to HTTPS for security
# We don't allow HTTP access to the ALB for enhanced security. The VPC origin only speaks HTTPS,
# so an internal ALB has no HTTP listener at all.
resource "aws_lb_listener" "http_listener" {
  count = var.internal ? 0 : 1

  load_balancer_arn = aws_lb.app_alb.arn
  port              = 80
  protocol          = "HTTP"

  # Always redirect to HTTPS for security
  default_action {
    type = "redirect"

    # Permanent redirect to HTTPS - enforces encryption in transit
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301" # Permanent redirect - browsers will cache this
    }
  }
}

# HTTPS Listener - handles encrypted traffic on port 443
resource "aws_lb_listener" "https_listener" {
  load_balancer_arn = aws_lb.app_alb.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06" # Latest TLS policy for security
  certificate_arn   = var.certificate_arn

  # Internal: only CloudFront's VPC origin can reach it, so everything is forwarded.
  # Internet-facing: anything without CloudFront's header gets a 403.
  default_action {
    type             = var.internal ? "forward" : "fixed-response"
    target_group_arn = var.internal ? aws_lb_target_group.app_tg.arn : null

    dynamic "fixed_response" {
      for_each = var.internal ? [] : [1]
      content {
        content_type = "application/json"
        message_body = jsonencode({ error = "Access denied. Invalid origin." })
        status_code  = "403"
      }
    }
  }
}

# CloudFront custom header condition and forwarding rule
# Only requests with the correct header are forwarded to the target group
resource "aws_lb_listener_rule" "cloudfront_header_rule" {
  count = var.internal ? 0 : 1

  listener_arn = aws_lb_listener.https_listener.arn
  priority     = 1

  # Match request with the custom header from CloudFront
  condition {
    http_header {
      http_header_name = var.cloudfront_header_name
      values           = [var.cloudfront_header_value]
    }
  }

  # Forward matching requests to the target group
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn
  }
}

# Without these, giving the listener and the rule a count would recreate them on the
# internet-facing ALB that serves traffic today.
moved {
  from = aws_lb_listener.http_listener
  to   = aws_lb_listener.http_listener[0]
}

moved {
  from = aws_lb_listener_rule.cloudfront_header_rule
  to   = aws_lb_listener_rule.cloudfront_header_rule[0]
}

# CloudFront reaches an internal ALB through a service-managed network interface in the VPC.
# Creating it waits until it is Deployed, which can take up to 15 minutes.
resource "aws_cloudfront_vpc_origin" "this" {
  count = var.internal ? 1 : 0

  vpc_origin_endpoint_config {
    name                   = "${var.service_name}-alb-${var.environment}"
    arn                    = aws_lb.app_alb.arn
    http_port              = 80
    https_port             = 443
    origin_protocol_policy = "https-only"

    origin_ssl_protocols {
      items    = ["TLSv1.2"]
      quantity = 1
    }
  }

  tags = merge(
    {
      Name        = "${var.service_name}-alb-${var.environment}"
      Environment = var.environment
      Service     = var.service_name
    },
    var.tags
  )
}
