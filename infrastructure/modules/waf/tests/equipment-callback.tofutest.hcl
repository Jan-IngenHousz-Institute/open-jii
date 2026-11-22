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
      rule.priority == 9 && length(rule.action[0].block) == 1
      if rule.name == "BlockMetadataQueryArgumentsRule"
      ]) && one([
      for rule in aws_wafv2_web_acl.main.rule :
      rule.priority == 8 && length(rule.action[0].count) == 1 && one(rule.rule_label).name == "LocalEquipmentCallback"
      if rule.name == "CountLocalEquipmentCallback"
      ]) && one([
      for rule in aws_wafv2_web_acl.main.rule : rule.priority > 9 if rule.name == "AllowLargeBodyRule"
    ])
    error_message = "The callback must be labeled before the follow-up block and the large body allow."
  }

  assert {
    condition = alltrue([
      for path in ["/login", "/register", "/en-US/login", "/en-US/register", "/de-DE/login", "/de-DE/register"] :
      can(regex(local.equipment_auth_path, path))
      ]) && alltrue([
      for path in ["/en-US/login-error", "/en-US/register/details", "/api/v1/auth/sign-in/social", "/other/login"] :
      !can(regex(local.equipment_auth_path, path))
    ])
    error_message = "Only login and registration paths can qualify."
  }

  assert {
    condition     = alltrue([for pattern in local.equipment_callback_queries : length(pattern) <= 512])
    error_message = "Each query pattern must fit the AWS WAF regex limit."
  }

  assert {
    condition = alltrue([
      for query in [
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Flogin%2Fopenjii",
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Faccount",
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Flogin%2Fopenjii%3Fredirect%3D%252Fassets%26state%3D0123456789abcdefghijklmnopqrstuvwxyzABCDEFG&_rsc=1234567890abcdef",
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Flogin%2Fopenjii%3Fredirect%3D%252Fassets%252520list%253Aname%252Cpart%2Btwo",
        "callbackUrl=%2Fen-US%2Fregister%3FcallbackUrl%3Dhttp%253A%252F%252Flocalhost%253A3100%252Flogin%252Fopenjii%253Fredirect%253D%25252Fassets&_rsc",
        "callbackUrl=%2Fde-DE%2Fregister%3FcallbackUrl%3Dhttp%253A%252F%252Flocalhost%253A3100%252Faccount",
      ] : anytrue([for pattern in local.equipment_callback_queries : can(regex(pattern, query))])
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
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Flogin%2Fopenjii%3Fredirect%3D%252Fassets%26extra%3D1",
        "callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Flogin%2Fopenjii&_rsc=abc&_rsc=def",
      ] : alltrue([for pattern in local.equipment_callback_queries : !can(regex(pattern, query))])
    ])
    error_message = "Other origins, paths and extra or repeated arguments must keep the managed block."
  }
}

run "dev_equipment_oauth_rule" {
  command = plan

  variables {
    service_name                   = "backend"
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
        length(override.action_to_use[0].count) == 1
        if override.name == "EC2MetaDataSSRF_BODY"
      ]) if rule.name == "AWSManagedRulesCommonRuleSet"
    ])
    error_message = "Dev backend must count and label body matches."
  }

  assert {
    condition = one([
      for rule in aws_wafv2_web_acl.main.rule :
      rule.priority == 9 && length(rule.action[0].block) == 1
      if rule.name == "BlockMetadataBodyRule"
      ]) && one([
      for rule in aws_wafv2_web_acl.main.rule : rule.priority > 9 if rule.name == "AllowLargeBodyRule"
    ])
    error_message = "Dev backend must block body matches before the terminating large body allow."
  }

  assert {
    condition = one(flatten([
      for rule in aws_wafv2_web_acl.main.rule : [
        for statement in rule.statement[0].and_statement[0].statement :
        statement.size_constraint_statement[0].comparison_operator == "LE" &&
        statement.size_constraint_statement[0].size == 8192 &&
        one(statement.size_constraint_statement[0].field_to_match[0].body).oversize_handling == "NO_MATCH"
        if length(statement.size_constraint_statement) == 1
      ] if rule.name == "CountLocalEquipmentCallback"
    ]))
    error_message = "An oversized body must fail the exception before it can be labeled."
  }

  assert {
    condition     = length(local.equipment_oauth_body) <= 512
    error_message = "The OAuth body pattern must fit the AWS WAF regex limit."
  }

  assert {
    condition = alltrue([
      for body in [
        "{\"provider\":\"github\",\"callbackURL\":\"https://dev.openjii.org/en-US/register?callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Flogin%2Fopenjii\",\"errorCallbackURL\":\"https://dev.openjii.org/login-error\"}",
        "{\"provider\":\"orcid\",\"callbackURL\":\"https://dev.openjii.org/de-DE/register?callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Faccount\",\"errorCallbackURL\":\"https://dev.openjii.org/login-error\"}",
      ] : can(regex(local.equipment_oauth_body, body))
    ])
    error_message = "The web GitHub and ORCID requests must qualify."
  }

  assert {
    condition = alltrue([
      for body in [
        "{\"provider\":\"other\",\"callbackURL\":\"https://dev.openjii.org/en-US/register?callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Faccount\",\"errorCallbackURL\":\"https://dev.openjii.org/login-error\"}",
        "{\"provider\":\"github\",\"callbackURL\":\"https://dev.openjii.org/en-US/register?callbackUrl=http%3A%2F%2Flocalhost%3A3200%2Faccount\",\"errorCallbackURL\":\"https://dev.openjii.org/login-error\"}",
        "{\"provider\":\"github\",\"callbackURL\":\"https://dev.openjii.org/en-US/register?callbackUrl=http%3A%2F%2Flocalhost%3A3100%2Faccount\",\"errorCallbackURL\":\"https://dev.openjii.org/login-error\",\"extra\":true}",
      ] : !can(regex(local.equipment_oauth_body, body))
    ])
    error_message = "Other providers, origins and extra JSON fields must stay outside the exception."
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
      for rule in aws_wafv2_web_acl.main.rule :
      !contains(["BlockMetadataQueryArgumentsRule", "BlockMetadataBodyRule", "CountLocalEquipmentCallback"], rule.name)
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
    service_name                   = "backend"
    environment                    = "prod"
    allow_local_equipment_callback = true
  }

  expect_failures = [var.allow_local_equipment_callback]
}
