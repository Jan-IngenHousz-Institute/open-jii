provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# Web Application Firewall (WAF) v2 for comprehensive application-layer protection
# WAF inspects HTTP/HTTPS requests before they reach the ALB
# Provides protection against common web exploits and application-layer attacks
resource "aws_wafv2_web_acl" "main" {
  provider    = aws.us_east_1
  name        = "${var.service_name}-waf-${var.environment}"
  description = "WAF for ${var.service_name} CloudFront Distribution"
  scope       = "CLOUDFRONT"

  # Default action when no rules match - allows legitimate traffic through
  # Consider changing to "block" for high-security environments with comprehensive rules
  default_action {
    allow {}
  }

  # Rule to block requests for sensitive paths like .git
  rule {
    name     = "BlockSensitivePaths"
    priority = 0 # Highest priority to block these requests first

    action {
      block {}
    }

    statement {
      byte_match_statement {
        search_string         = "/.git"
        positional_constraint = "STARTS_WITH"
        field_to_match {
          uri_path {}
        }
        text_transformation {
          priority = 0
          type     = "NONE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "BlockSensitivePathsMetric"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Core Rule Set - protects against OWASP Top 10 vulnerabilities
  # Includes protection against: SQL injection, XSS, path traversal, etc.
  # Maintained and updated by AWS security team - reduces management overhead
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    # override_action "none" means apply all rules in the group as-is
    # Use "count" for monitoring mode without blocking
    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # Exclude body size restriction rule for configured large body bypass routes
        dynamic "rule_action_override" {
          for_each = length(var.large_body_bypass_routes) > 0 ? [1] : []
          content {
            action_to_use {
              count {}
            }
            name = "SizeRestrictions_BODY"
          }
        }
      }
    }

    # CloudWatch metrics for monitoring WAF effectiveness and false positives
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSetMetric"
      sampled_requests_enabled   = true # Logs sample of blocked/allowed requests
    }
  }

  # AWS Managed Known Bad Inputs Rule Set - blocks requests with malicious patterns
  # Protects against known malicious inputs, exploit attempts, and vulnerability scanners
  # Complements the Core Rule Set with additional threat intelligence
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputsRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # AWS Managed Bot Control Rule Set - detects and manages bot traffic
  # Provides protection against scrapers, crawlers, and automated tools
  # Note: This adds cost (~$10/month + $1/million requests for common level)
  # Only created when enable_bot_control is true
  dynamic "rule" {
    for_each = var.enable_bot_control ? [1] : []
    content {
      name     = "AWSManagedRulesBotControlRuleSet"
      priority = 3 # After known bad inputs, before geo-blocking

      override_action {
        none {}
      }

      statement {
        managed_rule_group_statement {
          name        = "AWSManagedRulesBotControlRuleSet"
          vendor_name = "AWS"

          managed_rule_group_configs {
            aws_managed_rules_bot_control_rule_set {
              inspection_level = var.bot_control_inspection_level
            }
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "BotControlRuleSetMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  # Rate limiting protection against DDoS and brute force attacks
  # Blocks IP addresses that exceed the specified request rate within 5-minute windows
  # aggregate_key_type = "IP" means rate limit is per source IP address
  rule {
    name     = "RateLimitRule"
    priority = 4

    action {
      block {} # Block requests that exceed the rate limit
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit # Requests per 5-minute window per IP
        aggregate_key_type = "FORWARDED_IP" # Use forwarded IP from header
        # Alternative: "IP" for X-Forwarded-For header (behind proxy/CDN)
        forwarded_ip_config {
          header_name       = "X-Forwarded-For"
          fallback_behavior = "MATCH" # Use IP from request if header is missing
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRuleMetric"
      sampled_requests_enabled   = true
    }
  }

  # Geographic blocking - optional security measure
  # Useful for compliance requirements or reducing attack surface
  # Only creates the rule if blocked_countries list is provided
  dynamic "rule" {
    for_each = length(var.blocked_countries) > 0 ? [1] : []
    content {
      name     = "GeoBlockRule"
      priority = 5

      action {
        block {}
      }

      statement {
        geo_match_statement {
          country_codes = var.blocked_countries # ISO 3166-1 alpha-2 country codes
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "GeoBlockRuleMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  # Allow rule for large body bypass routes - runs AFTER all security checks
  # Only allows large body requests if they pass all other security rules first
  dynamic "rule" {
    for_each = length(var.large_body_bypass_routes) > 0 ? [1] : []
    content {
      name     = "AllowLargeBodyRule"
      priority = 6 # Run after all security checks including geographic blocking

      action {
        allow {}
      }

      statement {
        and_statement {
          # First condition: Body size is over 8KB (8192 bytes)
          statement {
            size_constraint_statement {
              field_to_match {
                body {
                  oversize_handling = "CONTINUE"
                }
              }
              comparison_operator = "GT"
              size                = 8192
              text_transformation {
                priority = 0
                type     = "NONE"
              }
            }
          }

          # Second condition: Body size is under configured maximum
          statement {
            size_constraint_statement {
              field_to_match {
                body {
                  oversize_handling = "CONTINUE"
                }
              }
              comparison_operator = "LT"
              size                = var.large_body_max_size
              text_transformation {
                priority = 0
                type     = "NONE"
              }
            }
          }

          # Single route case: flatten method + URI match into the outer and_statement
          dynamic "statement" {
            for_each = length(var.large_body_bypass_routes) == 1 ? [var.large_body_bypass_routes[0]] : []
            content {
              byte_match_statement {
                search_string         = statement.value.method
                positional_constraint = "EXACTLY"
                field_to_match {
                  method {}
                }
                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }
          }

          dynamic "statement" {
            for_each = length(var.large_body_bypass_routes) == 1 ? [var.large_body_bypass_routes[0]] : []
            content {
              byte_match_statement {
                search_string         = statement.value.search_string
                positional_constraint = statement.value.positional_constraint
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
              }
            }
          }

          # Multiple routes case: use or_statement wrapping and_statements
          dynamic "statement" {
            for_each = length(var.large_body_bypass_routes) >= 2 ? [1] : []
            content {
              or_statement {
                dynamic "statement" {
                  for_each = var.large_body_bypass_routes
                  content {
                    and_statement {
                      statement {
                        byte_match_statement {
                          search_string         = statement.value.method
                          positional_constraint = "EXACTLY"
                          field_to_match {
                            method {}
                          }
                          text_transformation {
                            priority = 0
                            type     = "NONE"
                          }
                        }
                      }
                      statement {
                        byte_match_statement {
                          search_string         = statement.value.search_string
                          positional_constraint = statement.value.positional_constraint
                          field_to_match {
                            uri_path {}
                          }
                          text_transformation {
                            priority = 0
                            type     = "LOWERCASE"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "AllowLargeBodyRuleMetric"
        sampled_requests_enabled   = true
      }
    }
  }

  tags = merge(
    {
      Name        = "${var.service_name}-waf-${var.environment}"
      Environment = var.environment
      Service     = var.service_name
    },
    var.tags
  )

  # Global visibility configuration for the entire WAF
  # Enables monitoring and analysis of all WAF activity
  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.service_name}WAF${var.environment}" # Consider adding "CloudFront" to metric name for clarity
    sampled_requests_enabled   = true
  }
}

# CloudWatch Log Group for WAF request logging
# Stores detailed logs of blocked/allowed requests for analysis and troubleshooting
# Retention period balances storage costs with compliance/debugging needs
resource "aws_cloudwatch_log_group" "waf_logs" {
  provider = aws.us_east_1 # Ensure log group is in us-east-1 for CloudFront WAF
  # AWS requires log group names for WAF to begin with "aws-waf-logs-"
  # https://docs.aws.amazon.com/waf/latest/developerguide/logging-cw-logs.html#logging-cw-logs-naming
  name              = "aws-waf-logs-${var.service_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = merge(
    {
      Name        = "aws-waf-logs-${var.service_name}-${var.environment}"
      Environment = var.environment
      Service     = var.service_name
    },
    var.tags
  )
}

# WAF Logging Configuration - enables detailed request logging
# Logs all requests processed by WAF including blocked and allowed traffic
# Essential for security analysis, false positive identification, and compliance
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  provider     = aws.us_east_1
  resource_arn = aws_wafv2_web_acl.main.arn
  # Use the ARN of our correctly named CloudWatch log group (with aws-waf-logs- prefix)
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs.arn]

  # Redact sensitive headers from logs to comply with security/privacy requirements
  # Authorization header contains tokens/credentials
  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  # Cookie header may contain session tokens and personal data
  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}
