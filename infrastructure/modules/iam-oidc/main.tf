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
              "repo:${var.repository}:environment:${var.github_environment}"
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
      actions = [
        # Terraform needs broad S3 permissions for state and resource management
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:ListBucket",
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy",
        "s3:DeleteBucketPolicy",
        "s3:PutBucketVersioning",
        "s3:GetBucketVersioning",
        "s3:PutEncryptionConfiguration",
        "s3:GetEncryptionConfiguration",
        "s3:PutBucketPublicAccessBlock",
        "s3:GetBucketPublicAccessBlock",
        "s3:PutBucketAcl",
        "s3:GetBucketAcl",
        "s3:PutBucketTagging",
        "s3:GetBucketTagging",
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListAllMyBuckets",
        "s3:GetBucketCORS",
        "s3:GetBucketWebsite",
        "s3:GetAccelerateConfiguration",
        "s3:GetBucketRequestPayment",
        "s3:GetBucketLogging",
        "s3:GetLifecycleConfiguration",
        "s3:GetReplicationConfiguration",
        "s3:GetBucketObjectLockConfiguration",
        "s3:GetBucketOwnershipControls",
        "s3:ListBucketVersions"
      ]
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
      actions = [
        # Terraform needs broad ECR permissions for infrastructure management
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:BatchCheckLayerAvailability",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:GetAuthorizationToken",
        "ecr:DescribeRepositories",
        "ecr:CreateRepository",
        "ecr:PutImageTagMutability",
        "ecr:DeleteRepository",
        "ecr:ListRepositories",
        "ecr:PutLifecyclePolicy",
        "ecr:GetLifecyclePolicy",
        "ecr:DeleteLifecyclePolicy",
        "ecr:TagResource",
        "ecr:UntagResource",
        "ecr:ListTagsForResource",
        "ecr:SetRepositoryPolicy",
        "ecr:GetRepositoryPolicy",
        "ecr:DeleteRepositoryPolicy"
      ]
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
      actions = [
        # Terraform needs broad Lambda permissions for infrastructure management
        "lambda:GetFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:GetFunctionConfiguration",
        "lambda:PublishVersion",
        "lambda:UpdateFunctionUrlConfig",
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:InvokeFunction",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:GetPolicy",
        "lambda:GetFunctionCodeSigningConfig",
        "lambda:GetFunctionConcurrency",
        "lambda:ListFunctions",
        "lambda:ListVersionsByFunction",
        "lambda:TagResource",
        "lambda:UntagResource",
        "lambda:ListTags"
      ]
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
      actions = [
        # Terraform needs broad CloudFront permissions for infrastructure management
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:DeleteDistribution",
        "cloudfront:GetDistribution",
        "cloudfront:ListDistributions",
        "cloudfront:GetOriginAccessControl",
        "cloudfront:ListTagsForResource",
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations",
        "cloudfront:CreateFunction",
        "cloudfront:DeleteFunction",
        "cloudfront:UpdateFunction",
        "cloudfront:DescribeFunction",
        "cloudfront:GetFunction",
        "cloudfront:CreateCachePolicy",
        "cloudfront:GetCachePolicy",
        "cloudfront:DeleteCachePolicy",
        "cloudfront:CreateOriginRequestPolicy",
        "cloudfront:GetOriginRequestPolicy",
        "cloudfront:DeleteOriginRequestPolicy"
      ]
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
      actions = [
        # Terraform needs broad ECS permissions for infrastructure management
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:DeregisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:ListServices",
        "ecs:ListTasks",
        "ecs:RunTask",
        "ecs:DescribeTasks",
        "ecs:StopTask",
        "ecs:DescribeClusters",
        "ecs:ListClusters",
        "ecs:CreateCluster",
        "ecs:DeleteCluster",
        "ecs:CreateService",
        "ecs:DeleteService",
        "ecs:ListTaskDefinitions",
        "ecs:TagResource",
        "ecs:UntagResource",
        "ecs:ListTagsForResource"
      ]
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
      actions = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:DescribeTable",
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:UpdateTable",
        "dynamodb:BatchWriteItem",
        "dynamodb:DescribeContinuousBackups",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:ListTagsOfResource",
        "dynamodb:TagResource",
        "dynamodb:UntagResource"
      ]
      resource = "*"
    }

    iam = {
      actions = [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:ListRolePolicies",
        "iam:GetRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
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
        "iam:TagRole",
        "iam:TagPolicy",
        "iam:TagUser",
        "iam:TagOpenIDConnectProvider",
        "iam:ListAttachedRolePolicies"
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
        "kms:DisableKeyRotation"
      ]
      resource = "*"
    }

    logs = {
      actions = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams",
        "logs:DescribeLogGroups",
        "logs:GetLogEvents",
        "logs:FilterLogEvents",
        "logs:DeleteLogGroup",
        "logs:ListTagsLogGroup",
        "logs:ListTagsForResource",
        "logs:PutRetentionPolicy"
      ]
      resource = "*"
    }

    sqs = {
      actions = [
        "sqs:CreateQueue",
        "sqs:DeleteQueue",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl",
        "sqs:ListQueues",
        "sqs:SetQueueAttributes",
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:TagQueue",
        "sqs:UntagQueue",
        "sqs:ListQueueTags"
      ]
      resource = "*"
    }

    vpc = {
      actions = [
        "ec2:CreateVpc",
        "ec2:DeleteVpc",
        "ec2:DescribeVpcs",
        "ec2:CreateSubnet",
        "ec2:DeleteSubnet",
        "ec2:DescribeSubnets",
        "ec2:CreateInternetGateway",
        "ec2:DeleteInternetGateway",
        "ec2:AttachInternetGateway",
        "ec2:DetachInternetGateway",
        "ec2:DescribeInternetGateways",
        "ec2:CreateRouteTable",
        "ec2:DeleteRouteTable",
        "ec2:DescribeRouteTables",
        "ec2:CreateRoute",
        "ec2:DeleteRoute",
        "ec2:AssociateRouteTable",
        "ec2:DisassociateRouteTable",
        "ec2:CreateSecurityGroup",
        "ec2:DeleteSecurityGroup",
        "ec2:DescribeSecurityGroups",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:AuthorizeSecurityGroupEgress",
        "ec2:RevokeSecurityGroupEgress",
        "ec2:CreateVpcEndpoint",
        "ec2:DeleteVpcEndpoint",
        "ec2:DescribeVpcEndpoints",
        "ec2:ModifyVpcEndpoint",
        "ec2:CreateTags",
        "ec2:DeleteTags",
        "ec2:DescribeTags",
        "ec2:DescribeNetworkInterfaces",
        "ec2:CreateNetworkInterface",
        "ec2:DeleteNetworkInterface",
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeVpcAttribute",
        "ec2:DescribeAddresses",
        "ec2:DescribeNatGateways",
        "ec2:DescribePrefixLists",
        "ec2:DescribeManagedPrefixLists",
        "ec2:DescribeNetworkAcls",
        "ec2:DescribeAddressesAttribute"
      ]
      resource = "*"
    }

    rds = {
      actions = [
        "rds:CreateDBCluster",
        "rds:DeleteDBCluster",
        "rds:ModifyDBCluster",
        "rds:DescribeDBClusters",
        "rds:CreateDBInstance",
        "rds:DeleteDBInstance",
        "rds:ModifyDBInstance",
        "rds:DescribeDBInstances",
        "rds:CreateDBSubnetGroup",
        "rds:DeleteDBSubnetGroup",
        "rds:ModifyDBSubnetGroup",
        "rds:DescribeDBSubnetGroups",
        "rds:CreateDBClusterParameterGroup",
        "rds:DeleteDBClusterParameterGroup",
        "rds:ModifyDBClusterParameterGroup",
        "rds:DescribeDBClusterParameterGroups",
        "rds:DescribeDBClusterParameters",
        "rds:AddTagsToResource",
        "rds:ListTagsForResource",
        "rds:RemoveTagsFromResource",
        "rds:DescribeDBClusterEndpoints"
      ]
      resource = "*"
    }

    secretsmanager = {
      actions = [
        "secretsmanager:CreateSecret",
        "secretsmanager:DeleteSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:PutSecretValue",
        "secretsmanager:UpdateSecret",
        "secretsmanager:GetResourcePolicy",
        "secretsmanager:PutResourcePolicy",
        "secretsmanager:DeleteResourcePolicy",
        "secretsmanager:TagResource",
        "secretsmanager:UntagResource",
        "secretsmanager:ListTagsForResource"
      ]
      resource = "*"
    }

    ses = {
      actions = [
        "ses:CreateIdentity",
        "ses:DeleteIdentity",
        "ses:GetIdentityVerificationAttributes",
        "ses:GetIdentityDkimAttributes",
        "ses:GetIdentityMailFromDomainAttributes",
        "ses:ListIdentities",
        "ses:VerifyEmailIdentity",
        "ses:GetEmailIdentity",
        "ses:CreateReceiptRuleSet",
        "ses:DeleteReceiptRuleSet",
        "ses:DescribeReceiptRuleSet",
        "ses:CreateConfigurationSet",
        "ses:DeleteConfigurationSet",
        "ses:DescribeConfigurationSet",
        "ses:TagResource",
        "ses:UntagResource"
      ]
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
        "wafv2:TagResource",
        "wafv2:UntagResource",
        "wafv2:ListTagsForResource"
      ]
      resource = "*"
    }

    route53 = {
      actions = [
        "route53:CreateHostedZone",
        "route53:DeleteHostedZone",
        "route53:GetHostedZone",
        "route53:ListHostedZones",
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets",
        "route53:GetChange",
        "route53:ListTagsForResource",
        "route53:TagResource",
        "route53:UntagResource"
      ]
      resource = "*"
    }

    location-service = {
      actions = [
        "geo:CreateMap",
        "geo:DeleteMap",
        "geo:DescribeMap",
        "geo:ListMaps",
        "geo:CreatePlaceIndex",
        "geo:DeletePlaceIndex",
        "geo:DescribePlaceIndex",
        "geo:ListPlaceIndexes",
        "geo:TagResource",
        "geo:UntagResource",
        "geo:ListTagsForResource"
      ]
      resource = "*"
    }

    timestream = {
      actions = [
        "timestream:CreateDatabase",
        "timestream:DeleteDatabase",
        "timestream:DescribeDatabase",
        "timestream:ListDatabases",
        "timestream:CreateTable",
        "timestream:DeleteTable",
        "timestream:DescribeTable",
        "timestream:ListTables",
        "timestream:TagResource",
        "timestream:UntagResource",
        "timestream:ListTagsForResource",
        "timestream:DescribeEndpoints"
      ]
      resource = "*"
    }

    kinesis = {
      actions = [
        "kinesis:CreateStream",
        "kinesis:DeleteStream",
        "kinesis:DescribeStream",
        "kinesis:ListStreams",
        "kinesis:PutRecord",
        "kinesis:PutRecords",
        "kinesis:TagResource",
        "kinesis:UntagResource",
        "kinesis:ListTagsForStream",
        "kinesis:DescribeStreamSummary"
      ]
      resource = "*"
    }

    iot = {
      actions = [
        "iot:CreateThing",
        "iot:DeleteThing",
        "iot:DescribeThing",
        "iot:UpdateThing",
        "iot:ListThings",
        "iot:CreateTopicRule",
        "iot:ReplaceTopicRule",
        "iot:DeleteTopicRule",
        "iot:GetTopicRule",
        "iot:ListTopicRules",
        "iot:CreateRoleAlias",
        "iot:DeleteRoleAlias",
        "iot:DescribeRoleAlias",
        "iot:ListRoleAliases",
        "iot:CreatePolicy",
        "iot:DeletePolicy",
        "iot:GetPolicy",
        "iot:ListPolicies",
        "iot:AttachPolicy",
        "iot:DetachPolicy",
        "iot:ListTagsForResource",
        "iot:GetV2LoggingOptions"
      ]
      resource = "*"
    }

    cognito = {
      actions = [
        "cognito-identity:CreateIdentityPool",
        "cognito-identity:DeleteIdentityPool",
        "cognito-identity:DescribeIdentityPool",
        "cognito-identity:ListIdentityPools",
        "cognito-identity:SetIdentityPoolRoles",
        "cognito-identity:GetIdentityPoolRoles",
        "cognito-identity:LookupDeveloperIdentity",
        "cognito-idp:CreateUserPool",
        "cognito-idp:DeleteUserPool",
        "cognito-idp:DescribeUserPool",
        "cognito-idp:ListUserPools",
        "cognito-idp:CreateUserPoolClient",
        "cognito-idp:DeleteUserPoolClient",
        "cognito-idp:DescribeUserPoolClient",
        "cognito-idp:ListUserPoolClients"
      ]
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
      actions = [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath"
      ]
      resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/open-jii/${var.environment}/*"
    }

    alb = {
      actions = [
        "elasticloadbalancing:CreateLoadBalancer",
        "elasticloadbalancing:DeleteLoadBalancer",
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeLoadBalancerAttributes",
        "elasticloadbalancing:ModifyLoadBalancerAttributes",
        "elasticloadbalancing:CreateTargetGroup",
        "elasticloadbalancing:DeleteTargetGroup",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:DescribeTargetGroupAttributes",
        "elasticloadbalancing:ModifyTargetGroupAttributes",
        "elasticloadbalancing:CreateListener",
        "elasticloadbalancing:DeleteListener",
        "elasticloadbalancing:DescribeListeners",
        "elasticloadbalancing:ModifyListener",
        "elasticloadbalancing:DescribeTargetHealth",
        "elasticloadbalancing:RegisterTargets",
        "elasticloadbalancing:DeregisterTargets",
        "elasticloadbalancing:AddTags",
        "elasticloadbalancing:RemoveTags",
        "elasticloadbalancing:DescribeTags"
      ]
      resource = "*"
    }

    eventbridge = {
      actions = [
        "events:PutRule",
        "events:DeleteRule",
        "events:DescribeRule",
        "events:EnableRule",
        "events:DisableRule",
        "events:PutTargets",
        "events:RemoveTargets",
        "events:ListTargetsByRule",
        "events:ListTagsForResource",
        "events:TagResource",
        "events:UntagResource"
      ]
      resource = "*"
    }

    acm = {
      actions = [
        "acm:RequestCertificate",
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "acm:GetCertificate",
        "acm:DeleteCertificate",
        "acm:AddTagsToCertificate",
        "acm:RemoveTagsFromCertificate",
        "acm:ListTagsForCertificate"
      ]
      resource = "*"
    }
  }

  # Combine all service permissions into five comprehensive policy
  all_policy_statements = [
    for service_key, service_config in local.service_policies : {
      Effect   = "Allow"
      Action   = service_config.actions
      Resource = service_config.resource
      Sid      = "${title(replace(service_key, "-", ""))}Permissions"
    }
  ]

  # Split policies into five groups to avoid 10KB size limit
  fifth_length = floor(length(local.all_policy_statements) / 5)
  policy_statements_part1 = slice(local.all_policy_statements, 0, local.fifth_length)
  policy_statements_part2 = slice(local.all_policy_statements, local.fifth_length, local.fifth_length * 2)
  policy_statements_part3 = slice(local.all_policy_statements, local.fifth_length * 2, local.fifth_length * 3)
  policy_statements_part4 = slice(local.all_policy_statements, local.fifth_length * 3, local.fifth_length * 4)
  policy_statements_part5 = slice(local.all_policy_statements, local.fifth_length * 4, length(local.all_policy_statements))
}

resource "aws_iam_role_policy" "oidc_role_inline_policy_part1" {
  name = "${var.role_name}InlinePolicy1-v2"
  role = aws_iam_role.oidc_role.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = local.policy_statements_part1
  })
}

resource "aws_iam_role_policy" "oidc_role_inline_policy_part2" {
  name = "${var.role_name}InlinePolicy2-v2"
  role = aws_iam_role.oidc_role.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = local.policy_statements_part2
  })
}

resource "aws_iam_role_policy" "oidc_role_inline_policy_part3" {
  name = "${var.role_name}InlinePolicy3-v2"
  role = aws_iam_role.oidc_role.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = local.policy_statements_part3
  })
}

resource "aws_iam_role_policy" "oidc_role_inline_policy_part4" {
  name = "${var.role_name}InlinePolicy4-v2"
  role = aws_iam_role.oidc_role.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = local.policy_statements_part4
  })
}

resource "aws_iam_role_policy" "oidc_role_inline_policy_part5" {
  name = "${var.role_name}InlinePolicy5-v2"
  role = aws_iam_role.oidc_role.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = local.policy_statements_part5
  })
}