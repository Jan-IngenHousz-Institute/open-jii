data "aws_caller_identity" "current" {}

resource "aws_iam_openid_connect_provider" "github" {
  url             = var.oidc_provider_url
  client_id_list  = var.client_id_list
  thumbprint_list = var.thumbprint_list
}

resource "aws_iam_role" "oidc_role" {
  name = var.role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        },
        Action = "sts:AssumeRoleWithWebIdentity",
        Condition = {
          "StringLike" : {
            "token.actions.githubusercontent.com:sub" : [
              "repo:${var.repository}:ref:refs/heads/${var.branch}",
              "repo:${var.repository}:pull_request",
              "repo:${var.repository}:environment:${var.github_environment}",
              "repo:${var.repository}:environment:pr"
            ]
          },
          "StringEquals" : {
            "token.actions.githubusercontent.com:aud" : "sts.amazonaws.com"
          }
        }
      }
    ]
  })
}

locals {
  # Define all service-specific permissions
  service_policies = {
    s3 = {
      actions  = ["s3:*"]
      resource = "*"
    }

    # Minimal S3 for deployment (NextJS assets only)
    s3-deploy = {
      actions = [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ]
      resource = "*"
    }

    ecr = {
      actions  = ["ecr:*"]
      resource = "*"
    }

    # Minimal ECR for deployment (push/pull images only)
    ecr-deploy = {
      actions = [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:GetAuthorizationToken",
        "ecr:DescribeRepositories"
      ]
      resource = "*"
    }

    lambda = {
      actions  = ["lambda:*"]
      resource = "*"
    }

    # Minimal Lambda for deployment (NextJS function updates only)
    lambda-deploy = {
      actions = [
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:UpdateFunctionCode"
      ]
      resource = "*"
    }

    cloudfront = {
      actions  = ["cloudfront:*"]
      resource = "*"
    }

    # Minimal CloudFront for deployment (invalidations only)
    cloudfront-deploy = {
      actions = [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ]
      resource = "*"
    }

    ecs = {
      actions  = ["ecs:*"]
      resource = "*"
    }

    # Minimal ECS for deployment (update services and run tasks only)
    ecs-deploy = {
      actions = [
        "ecs:DescribeClusters",
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeTaskDefinition",
        "ecs:RunTask",
        "ecs:DescribeTasks"
      ]
      resource = "*"
    }

    dynamodb = {
      actions  = ["dynamodb:*"]
      resource = "*"
    }

    iam = {
      actions = [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:ListRoles",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:ListAttachedRolePolicies",
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:GetPolicy",
        "iam:ListPolicyVersions",
        "iam:GetPolicyVersion",
        "iam:CreatePolicyVersion",
        "iam:DeletePolicyVersion",
        "iam:SetDefaultPolicyVersion",
        "iam:PassRole",
        "iam:CreateOpenIDConnectProvider",
        "iam:DeleteOpenIDConnectProvider",
        "iam:GetOpenIDConnectProvider",
        "iam:CreateUser",
        "iam:DeleteUser",
        "iam:GetUser",
        "iam:ListAccessKeys",
        "iam:ListAttachedUserPolicies",
        "iam:TagRole",
        "iam:TagPolicy",
        "iam:TagUser",
        "iam:TagOpenIDConnectProvider",
        "iam:UpdateAssumeRolePolicy"
      ]
      resource = "*"
    }

    kms = {
      actions = [
        "kms:CreateKey",
        "kms:DescribeKey",
        "kms:GetKeyPolicy",
        "kms:PutKeyPolicy",
        "kms:CreateAlias",
        "kms:DeleteAlias",
        "kms:ListAliases",
        "kms:ListResourceTags",
        "kms:TagResource",
        "kms:UntagResource",
        "kms:ScheduleKeyDeletion",
        "kms:EnableKeyRotation",
        "kms:DisableKeyRotation",
        "kms:GetKeyRotationStatus"
      ]
      resource = "*"
    }

    logs = {
      actions  = ["logs:*"]
      resource = "*"
    }

    cloudwatch = {
      actions = [
        "cloudwatch:PutMetricData",
        "cloudwatch:GetMetricData",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ]
      resource = "*"
    }

    sqs = {
      actions  = ["sqs:*"]
      resource = "*"
    }

    vpc = {
      actions  = ["ec2:*"]
      resource = "*"
    }

    rds = {
      actions  = ["rds:*"]
      resource = "*"
    }

    secretsmanager = {
      actions  = ["secretsmanager:*"]
      resource = "*"
    }

    ses = {
      actions  = ["ses:*"]
      resource = "*"
    }

    waf = {
      actions = [
        "wafv2:CreateWebACL",
        "wafv2:DeleteWebACL",
        "wafv2:UpdateWebACL",
        "wafv2:GetWebACL",
        "wafv2:ListWebACLs",
        "wafv2:CreateIPSet",
        "wafv2:DeleteIPSet",
        "wafv2:UpdateIPSet",
        "wafv2:GetIPSet",
        "wafv2:ListIPSets",
        "wafv2:GetLoggingConfiguration",
        "wafv2:PutLoggingConfiguration",
        "wafv2:DeleteLoggingConfiguration",
        "wafv2:AssociateWebACL",
        "wafv2:DisassociateWebACL",
        "wafv2:GetWebACLForResource",
        "wafv2:ListResourcesForWebACL",
        "wafv2:TagResource",
        "wafv2:UntagResource",
        "wafv2:ListTagsForResource"
      ]
      resource = "*"
    }

    route53 = {
      actions  = ["route53:*"]
      resource = "*"
    }

    location-service = {
      actions  = ["geo:*"]
      resource = "*"
    }

    timestream = {
      actions  = ["timestream:*"]
      resource = "*"
    }

    kinesis = {
      actions  = ["kinesis:*"]
      resource = "*"
    }

    iot = {
      actions  = ["iot:*"]
      resource = "*"
    }

    cognito = {
      actions  = ["cognito-identity:*", "cognito-idp:*"]
      resource = "*"
    }

    terraform-backend = {
      actions = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem"
      ]
      resource = [
        "arn:aws:s3:::open-jii-terraform-state-${var.environment}",
        "arn:aws:s3:::open-jii-terraform-state-${var.environment}/*",
        "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/terraform-state-lock"
      ]
    }

    ssm = {
      actions  = ["ssm:*"]
      resource = "*"
    }

    alb = {
      actions  = ["elasticloadbalancing:*"]
      resource = "*"
    }

    eventbridge = {
      actions  = ["events:*"]
      resource = "*"
    }

    acm = {
      actions  = ["acm:*"]
      resource = "*"
    }

    servicediscovery = {
      actions  = ["servicediscovery:*"]
      resource = "*"
    }

    autoscaling = {
      actions  = ["application-autoscaling:*"]
      resource = "*"
    }

    sts = {
      actions = [
        "sts:GetCallerIdentity"
      ]
      resource = "*"
    }

    grafana = {
      actions = [
        "grafana:CreateWorkspace",
        "grafana:DeleteWorkspace",
        "grafana:DescribeWorkspace",
        "grafana:ListWorkspaces",
        "grafana:UpdateWorkspace",
        "grafana:UpdateWorkspaceAuthentication",
        "grafana:UpdateWorkspaceConfiguration",
        "grafana:AssociateLicense",
        "grafana:DisassociateLicense",
        "grafana:ListPermissions",
        "grafana:UpdatePermissions",
        "grafana:CreateWorkspaceApiKey",
        "grafana:DeleteWorkspaceApiKey",
        "grafana:DescribeWorkspaceApiKey",
        "grafana:ListWorkspaceApiKeys",
        "grafana:CreateWorkspaceServiceAccount",
        "grafana:DeleteWorkspaceServiceAccount",
        "grafana:DescribeWorkspaceServiceAccount",
        "grafana:ListWorkspaceServiceAccounts",
        "grafana:CreateWorkspaceServiceAccountToken",
        "grafana:DeleteWorkspaceServiceAccountToken",
        "grafana:ListWorkspaceServiceAccountTokens",
        "grafana:DescribeWorkspaceConfiguration"
      ]
      resource = "*"
    }

    cloudtrail = {
      actions = [
        "cloudtrail:CreateTrail",
        "cloudtrail:UpdateTrail",
        "cloudtrail:DeleteTrail",
        "cloudtrail:DescribeTrails",
        "cloudtrail:GetTrail",
        "cloudtrail:GetTrailStatus",
        "cloudtrail:StartLogging",
        "cloudtrail:StopLogging",
        "cloudtrail:PutEventSelectors",
        "cloudtrail:GetEventSelectors",
        "cloudtrail:AddTags",
        "cloudtrail:RemoveTags",
        "cloudtrail:ListTags"
      ]
      resource = "*"
    }
  }

  # Combine all service permissions into comprehensive policy statements
  all_policy_statements = [
    for service_key, service_config in local.service_policies : {
      Effect   = "Allow"
      Action   = service_config.actions
      Resource = service_config.resource
      Sid      = "${title(replace(service_key, "-", ""))}Permissions"
    }
  ]

  # Split policies into 10 groups (AWS limit is 10 inline policies per role)
  num_policy_parts    = 10
  statements_per_part = ceil(length(local.all_policy_statements) / local.num_policy_parts)

  # Create a map of policy parts for for_each
  policy_parts = {
    for i in range(local.num_policy_parts) : tostring(i + 1) => slice(
      local.all_policy_statements,
      i * local.statements_per_part,
      min((i + 1) * local.statements_per_part, length(local.all_policy_statements))
    ) if i * local.statements_per_part < length(local.all_policy_statements)
  }
}

resource "aws_iam_role_policy" "oidc_role_inline_policies" {
  for_each = local.policy_parts

  name = "${var.role_name}InlinePolicy${each.key}"
  role = aws_iam_role.oidc_role.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = each.value
  })
}
