mock_provider "aws" {
  alias = "us_east_1"

  mock_resource "aws_wafv2_web_acl" {
    defaults = {
      arn = "arn:aws:wafv2:us-east-1:000000000000:global/webacl/opennext/00000000-0000-0000-0000-000000000000"
    }
  }

  mock_resource "aws_cloudwatch_log_group" {
    defaults = {
      arn = "arn:aws:logs:us-east-1:000000000000:log-group:aws-waf-logs-opennext"
    }
  }
}

variables {
  service_name = "opennext"
}

run "dev_equipment_callback_rule" {
  command = plan

  variables {
    environment                    = "dev"
    allow_local_equipment_callback = true
    large_body_bypass_routes = [{
      method                = "POST"
      positional_constraint = "EXACTLY"
      search_string         = "/uploads"
    }]
  }

  assert {
    condition = one([
      for rule in aws_wafv2_web_acl.main.rule : one([
        for override in rule.statement[0].managed_rule_group_statement[0].rule_action_override :
        length(override.action_to_use[0].count) == 1 if override.name == "EC2MetaDataSSRF_QUERYARGUMENTS"
      ]) if rule.name == "AWSManagedRulesCommonRuleSet"
    ])
    error_message = "The Common Rule Set must count and label matching query arguments."
  }

  assert {
    condition = one([
      for rule in aws_wafv2_web_acl.main.rule :
      rule.priority > 1 && length(rule.action[0].block) == 1
      if rule.name == "BlockMetadataQueryArgumentsRule"
      ]) && one([
      for rule in aws_wafv2_web_acl.main.rule : rule.priority > 8 if rule.name == "AllowLargeBodyRule"
    ])
    error_message = "The label rule must block after the managed rules and before the large body allow."
  }

  assert {
    condition = alltrue([
      for path in ["/en-US/login", "/en-US/register", "/de-DE/login", "/de-DE/register"] :
      can(regex(local.equipment_auth_path, path))
      ]) && alltrue([
      for path in ["/en-US/login-error", "/en-US/register/details", "/api/v1/auth/sign-in/social", "/other/login"] :
      !can(regex(local.equipment_auth_path, path))
    ])
    error_message = "Only localized login and registration paths can qualify."
  }

  assert {
    condition = alltrue([
      for query in [
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Flogin%2Fopenjii",
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Flogin%2Fopenjii%3Fredirect%3D%252Fassets%26state%3D0123456789abcdefghijklmnopqrstuvwxyzABCDEFG&_rsc=1234567890abcdef",
        "callbackUrl=%2Fen-US%2Fregister%3FcallbackUrl%3Dhttp%253A%252F%252Flocalhost%253A3100%252Flogin%252Fopenjii%253Fredirect%253D%25252Fassets&_rsc",
      ] : can(regex(local.equipment_callback_query, query))
    ])
    error_message = "Direct, client navigation, and signed-out registration queries must qualify."
  }

  assert {
    condition = alltrue([
      for query in [
        "callbackUrl=http%3A%2F%2Flocalhost%3A3200%2Flogin%2Fopenjii",
        "callbackUrl=http%3A%2F%2Flocalhost.example%3A3100%2Flogin%2Fopenjii",
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Fanother-path",
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Flogin%2Fopenjii&callbackUrl=%2Fplatform",
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Flogin%2Fopenjii&extra=1",
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Flogin%2Fopenjii&_rsc=abc&_rsc=def",
      ] : !can(regex(local.equipment_callback_query, query))
    ])
    error_message = "Other origins, paths and extra or repeated arguments must keep the managed block."
  }
}

run "production_keeps_managed_block" {
  command = plan

  variables {
    environment                  = "prod"
    rate_limit                   = 2500
    enable_bot_control           = true
    managed_rules_excluded_paths = ["/ingest"]
    allow_page_regeneration      = true
  }

  assert {
    condition = alltrue([
      for rule in aws_wafv2_web_acl.main.rule : rule.name != "BlockMetadataQueryArgumentsRule"
      ]) && alltrue([
      for rule in aws_wafv2_web_acl.main.rule :
      alltrue([
        for override in rule.statement[0].managed_rule_group_statement[0].rule_action_override :
        override.name != "EC2MetaDataSSRF_QUERYARGUMENTS"
      ]) if rule.name == "AWSManagedRulesCommonRuleSet"
    ])
    error_message = "Production must use the original managed action with no label rule."
  }
}

run "rejects_production_override" {
  command = plan

  variables {
    environment                    = "prod"
    allow_local_equipment_callback = true
  }

  expect_failures = [var.allow_local_equipment_callback]
}
