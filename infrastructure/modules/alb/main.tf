# Application Load Balancer - Layer 7 load balancer with advanced routing
# Internet-facing ALB that only accepts traffic from CloudFront via custom header verification

resource "aws_lb" "app_alb" {
  name               = "${var.service_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = var.security_groups
  subnets            = var.public_subnet_ids
  # Idle timeout balances connection efficiency vs resource usage
  # 60s default is good for APIs; increase for long-running connections
  idle_timeout = var.idle_timeout

  # Deletion protection prevents accidental ALB deletion in production
  # Disabled in dev/staging for easier teardown
  enable_deletion_protection = var.environment == "prod" ? true : false

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
# We don't allow HTTP access to the ALB for enhanced security
resource "aws_lb_listener" "http_listener" {
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

# HTTPS Listener - handles encrypted traffic on port 443 with custom header validation
resource "aws_lb_listener" "https_listener" {
  load_balancer_arn = aws_lb.app_alb.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06" # Latest TLS policy for security
  certificate_arn   = var.certificate_arn

  # Default action: If no header match, return 403 Forbidden
  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "application/json"
      message_body = jsonencode({ error = "Access denied. Invalid origin." })
      status_code  = "403"
    }
  }
}

# CloudFront custom header condition and forwarding rule
# Only requests with the correct header are forwarded to the target group
resource "aws_lb_listener_rule" "cloudfront_header_rule" {
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
