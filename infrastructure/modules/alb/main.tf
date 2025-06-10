# Local values for conditional SSL/HTTPS configuration
# SSL is only enabled when certificate_arn is provided
# This allows the module to work with or without SSL
locals {
  enable_ssl = var.certificate_arn != ""
}

# Application Load Balancer - Layer 7 load balancer with advanced routing
# internet-facing ALB accepts traffic from the internet and forwards to private ECS tasks
resource "aws_lb" "app_alb" {
  name               = "${var.service_name}-alb"
  internal           = false # Public-facing ALB for internet traffic
  load_balancer_type = "application"
  security_groups    = var.security_groups
  subnets            = var.public_subnet_ids

  # Idle timeout balances connection efficiency vs resource usage
  # 60s default is good for APIs; increase for long-running connections
  idle_timeout = var.idle_timeout

  # Deletion protection prevents accidental ALB deletion in production
  # Disabled in dev/staging for easier teardown
  enable_deletion_protection = var.environment == "Prod" ? true : false

  # Access logs provide detailed request-level logging for debugging and analytics
  # Requires S3 bucket and costs ~$0.006 per GB of logs
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

# HTTP Listener - handles all traffic on port 80
# Behavior depends on SSL configuration:
# - With SSL: Redirects all HTTP traffic to HTTPS (security best practice)
# - Without SSL: Forwards traffic directly to target group
resource "aws_lb_listener" "http_listener" {
  load_balancer_arn = aws_lb.app_alb.arn
  port              = 80
  protocol          = "HTTP"

  # Conditional logic: redirect to HTTPS if SSL is enabled, otherwise forward to target group
  default_action {
    type = local.enable_ssl ? "redirect" : "forward"

    # HTTPS redirect configuration - enforces encryption in transit
    dynamic "redirect" {
      for_each = local.enable_ssl ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301" # Permanent redirect - browsers will cache this
      }
    }

    # Direct forwarding for non-SSL setups (dev environments)
    dynamic "forward" {
      for_each = local.enable_ssl ? [] : [1]
      content {
        target_group {
          arn = aws_lb_target_group.app_tg.arn
        }
      }
    }
  }
}

# HTTPS Listener - handles encrypted traffic on port 443
# Only created when SSL is enabled (certificate_arn is provided)
resource "aws_lb_listener" "https_listener" {
  count             = local.enable_ssl ? 1 : 0
  load_balancer_arn = aws_lb.app_alb.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06" # Latest TLS policy for security
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg.arn
  }
}
