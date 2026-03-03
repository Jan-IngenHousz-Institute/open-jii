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
  # ──────────────────────────────────────────────────────────────────────
  # Service-specific permissions for GitHub Actions OIDC role.
  # This role is used by BOTH deploy workflows (CI/CD) and OpenTofu
  # (infrastructure management), so each block covers both use-cases.
  # ──────────────────────────────────────────────────────────────────────
  service_policies = {

    # ── S3: bucket management (Terraform) + object ops (deploy / state) ──
    s3 = {
      actions = [
        # Bucket CRUD (Terraform)
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:ListBucket",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        # Bucket configuration (Terraform)
        "s3:GetBucketVersioning",
        "s3:PutBucketVersioning",
        "s3:GetEncryptionConfiguration",
        "s3:PutEncryptionConfiguration",
        "s3:GetBucketPublicAccessBlock",
        "s3:PutBucketPublicAccessBlock",
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy",
        "s3:DeleteBucketPolicy",
        "s3:GetBucketAcl",
        "s3:PutBucketAcl",
        "s3:GetBucketOwnershipControls",
        "s3:PutBucketOwnershipControls",
        "s3:GetLifecycleConfiguration",
        "s3:PutLifecycleConfiguration",
        "s3:GetBucketCors",
        "s3:PutBucketCors",
        "s3:GetBucketTagging",
        "s3:PutBucketTagging",
        "s3:GetBucketLogging",
        "s3:PutBucketLogging",
        "s3:GetBucketObjectLockConfiguration",
        "s3:GetAccelerateConfiguration",
        "s3:GetBucketRequestPayment",
        "s3:GetBucketWebsite",
        "s3:GetReplicationConfiguration",
        # Object operations (deploy workflows + Terraform state)
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucketVersions",
        "s3:GetObjectVersion",
        "s3:DeleteObjectVersion",
      ]
      resource = "*"
    }

    # ── ECR: repository management (Terraform) + image push (deploy) ──
    ecr = {
      actions = [
        # Repository CRUD (Terraform)
        "ecr:CreateRepository",
        "ecr:DeleteRepository",
        "ecr:DescribeRepositories",
        "ecr:PutLifecyclePolicy",
        "ecr:GetLifecyclePolicy",
        "ecr:DeleteLifecyclePolicy",
        "ecr:SetRepositoryPolicy",
        "ecr:GetRepositoryPolicy",
        "ecr:DeleteRepositoryPolicy",
        "ecr:TagResource",
        "ecr:UntagResource",
        "ecr:ListTagsForResource",
        # Image push/pull (deploy workflows)
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
      ]
      resource = "*"
    }

    # ── Lambda: function management (Terraform) + code deploy + invoke ──
    lambda = {
      actions = [
        # Function CRUD (Terraform)
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:PublishVersion",
        "lambda:ListVersionsByFunction",
        # Alias management (Terraform + deploy)
        "lambda:CreateAlias",
        "lambda:DeleteAlias",
        "lambda:GetAlias",
        "lambda:UpdateAlias",
        # Permissions (Terraform)
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:GetPolicy",
        # Event source mappings (Terraform)
        "lambda:CreateEventSourceMapping",
        "lambda:DeleteEventSourceMapping",
        "lambda:GetEventSourceMapping",
        "lambda:UpdateEventSourceMapping",
        # Function URLs (Terraform)
        "lambda:CreateFunctionUrlConfig",
        "lambda:DeleteFunctionUrlConfig",
        "lambda:GetFunctionUrlConfig",
        "lambda:UpdateFunctionUrlConfig",
        # Tags (Terraform)
        "lambda:TagResource",
        "lambda:UntagResource",
        "lambda:ListTags",
        # Health checks (deploy workflows)
        "lambda:InvokeFunction",
        # Concurrency (Terraform)
        "lambda:PutFunctionConcurrency",
        "lambda:DeleteFunctionConcurrency",
        "lambda:GetFunctionConcurrency",
      ]
      resource = "*"
    }

    # ── CloudFront: distribution management (Terraform) + invalidation (deploy) ──
    cloudfront = {
      actions = [
        # Distribution CRUD (Terraform)
        "cloudfront:CreateDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:DeleteDistribution",
        "cloudfront:GetDistribution",
        "cloudfront:ListDistributions",
        # Origin Access Control (Terraform)
        "cloudfront:CreateOriginAccessControl",
        "cloudfront:UpdateOriginAccessControl",
        "cloudfront:DeleteOriginAccessControl",
        "cloudfront:GetOriginAccessControl",
        "cloudfront:ListOriginAccessControls",
        # CloudFront Functions (Terraform)
        "cloudfront:CreateFunction",
        "cloudfront:UpdateFunction",
        "cloudfront:DeleteFunction",
        "cloudfront:GetFunction",
        "cloudfront:DescribeFunction",
        "cloudfront:PublishFunction",
        # Cache / origin request policies (Terraform)
        "cloudfront:CreateCachePolicy",
        "cloudfront:UpdateCachePolicy",
        "cloudfront:DeleteCachePolicy",
        "cloudfront:GetCachePolicy",
        "cloudfront:CreateOriginRequestPolicy",
        "cloudfront:UpdateOriginRequestPolicy",
        "cloudfront:DeleteOriginRequestPolicy",
        "cloudfront:GetOriginRequestPolicy",
        # Tags (Terraform)
        "cloudfront:TagResource",
        "cloudfront:UntagResource",
        "cloudfront:ListTagsForResource",
        # Invalidation (deploy workflows)
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
      ]
      resource = "*"
    }

    # ── ECS: cluster/service management (Terraform) + deploy + migrations ──
    ecs = {
      actions = [
        # Cluster CRUD (Terraform)
        "ecs:CreateCluster",
        "ecs:DeleteCluster",
        "ecs:DescribeClusters",
        "ecs:UpdateCluster",
        "ecs:PutClusterCapacityProviders",
        "ecs:DescribeCapacityProviders",
        # Service CRUD (Terraform + deploy)
        "ecs:CreateService",
        "ecs:UpdateService",
        "ecs:DeleteService",
        "ecs:DescribeServices",
        "ecs:ListServices",
        # Task definitions (Terraform + deploy)
        "ecs:RegisterTaskDefinition",
        "ecs:DeregisterTaskDefinition",
        "ecs:DescribeTaskDefinition",
        # Task execution (deploy — migrations runner)
        "ecs:RunTask",
        "ecs:DescribeTasks",
        "ecs:ListTasks",
        "ecs:StopTask",
        # Tags (Terraform)
        "ecs:TagResource",
        "ecs:UntagResource",
        "ecs:ListTagsForResource",
      ]
      resource = "*"
    }

    # ── DynamoDB: table management (Terraform) ──
    dynamodb = {
      actions = [
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:UpdateTable",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:UpdateTimeToLive",
        "dynamodb:DescribeContinuousBackups",
        "dynamodb:UpdateContinuousBackups",
        "dynamodb:TagResource",
        "dynamodb:UntagResource",
        "dynamodb:ListTagsOfResource",
        # State locking (also covered by terraform-backend with resource scope)
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
      ]
      resource = "*"
    }

    # ── IAM: role/policy/user management (Terraform) ──
    iam = {
      actions = [
        # Roles
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:ListRoles",
        "iam:UpdateAssumeRolePolicy",
        "iam:PassRole",
        "iam:TagRole",
        # Role policies (inline)
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        # Role policies (managed)
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:ListAttachedRolePolicies",
        # Managed policies
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:GetPolicy",
        "iam:ListPolicyVersions",
        "iam:GetPolicyVersion",
        "iam:CreatePolicyVersion",
        "iam:DeletePolicyVersion",
        "iam:SetDefaultPolicyVersion",
        "iam:TagPolicy",
        # OIDC provider (Terraform — self-managing)
        "iam:CreateOpenIDConnectProvider",
        "iam:DeleteOpenIDConnectProvider",
        "iam:GetOpenIDConnectProvider",
        "iam:TagOpenIDConnectProvider",
        # Users (SES SMTP user)
        "iam:CreateUser",
        "iam:DeleteUser",
        "iam:GetUser",
        "iam:TagUser",
        "iam:ListAccessKeys",
        "iam:ListAttachedUserPolicies",
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
        "kms:GetKeyRotationStatus",
      ]
      resource = "*"
    }

    # ── CloudWatch Logs: log group management (Terraform) ──
    logs = {
      actions = [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:DescribeLogGroups",
        "logs:PutRetentionPolicy",
        "logs:DeleteRetentionPolicy",
        "logs:TagResource",
        "logs:UntagResource",
        "logs:ListTagsForResource",
        "logs:ListTagsLogGroup",
        "logs:TagLogGroup",
      ]
      resource = "*"
    }

    # ── CloudWatch Metrics: DORA metrics (deploy) + dashboard reads ──
    cloudwatch = {
      actions = [
        "cloudwatch:PutMetricData",
        "cloudwatch:GetMetricData",
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
      ]
      resource = "*"
    }

    # ── SQS: queue management (Terraform — OpenNext revalidation) ──
    sqs = {
      actions = [
        "sqs:CreateQueue",
        "sqs:DeleteQueue",
        "sqs:GetQueueAttributes",
        "sqs:SetQueueAttributes",
        "sqs:GetQueueUrl",
        "sqs:ListQueues",
        "sqs:TagQueue",
        "sqs:UntagQueue",
        "sqs:ListQueueTags",
      ]
      resource = "*"
    }

    # ── EC2 / VPC: network infrastructure management (Terraform) ──
    vpc = {
      actions = [
        # VPC
        "ec2:CreateVpc",
        "ec2:DeleteVpc",
        "ec2:DescribeVpcs",
        "ec2:ModifyVpcAttribute",
        "ec2:DescribeVpcAttribute",
        # Subnets
        "ec2:CreateSubnet",
        "ec2:DeleteSubnet",
        "ec2:DescribeSubnets",
        "ec2:ModifySubnetAttribute",
        # Security Groups
        "ec2:CreateSecurityGroup",
        "ec2:DeleteSecurityGroup",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSecurityGroupRules",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:AuthorizeSecurityGroupEgress",
        "ec2:RevokeSecurityGroupEgress",
        # Route Tables
        "ec2:CreateRouteTable",
        "ec2:DeleteRouteTable",
        "ec2:DescribeRouteTables",
        "ec2:CreateRoute",
        "ec2:DeleteRoute",
        "ec2:ReplaceRoute",
        "ec2:AssociateRouteTable",
        "ec2:DisassociateRouteTable",
        # Internet Gateway
        "ec2:CreateInternetGateway",
        "ec2:DeleteInternetGateway",
        "ec2:AttachInternetGateway",
        "ec2:DetachInternetGateway",
        "ec2:DescribeInternetGateways",
        # NAT Gateway
        "ec2:CreateNatGateway",
        "ec2:DeleteNatGateway",
        "ec2:DescribeNatGateways",
        # Elastic IP
        "ec2:AllocateAddress",
        "ec2:ReleaseAddress",
        "ec2:DescribeAddresses",
        # VPC Endpoints
        "ec2:CreateVpcEndpoint",
        "ec2:DeleteVpcEndpoints",
        "ec2:DescribeVpcEndpoints",
        "ec2:ModifyVpcEndpoint",
        # Tags
        "ec2:CreateTags",
        "ec2:DeleteTags",
        "ec2:DescribeTags",
        # Read-only (data sources + plan)
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeAccountAttributes",
        "ec2:DescribeNetworkAcls",
        "ec2:DescribeNetworkInterfaces",
        "ec2:DescribePrefixLists",
        "ec2:DescribeManagedPrefixLists",
        "ec2:GetManagedPrefixListEntries",
      ]
      resource = "*"
    }

    # ── RDS: Aurora Serverless cluster management (Terraform) ──
    rds = {
      actions = [
        # Cluster
        "rds:CreateDBCluster",
        "rds:DeleteDBCluster",
        "rds:DescribeDBClusters",
        "rds:ModifyDBCluster",
        # Instance
        "rds:CreateDBInstance",
        "rds:DeleteDBInstance",
        "rds:DescribeDBInstances",
        "rds:ModifyDBInstance",
        # Parameter groups
        "rds:CreateDBClusterParameterGroup",
        "rds:DeleteDBClusterParameterGroup",
        "rds:DescribeDBClusterParameterGroups",
        "rds:ModifyDBClusterParameterGroup",
        "rds:DescribeDBClusterParameters",
        # Subnet groups
        "rds:CreateDBSubnetGroup",
        "rds:DeleteDBSubnetGroup",
        "rds:DescribeDBSubnetGroups",
        "rds:ModifyDBSubnetGroup",
        # Tags
        "rds:AddTagsToResource",
        "rds:RemoveTagsFromResource",
        "rds:ListTagsForResource",
        # Read-only (plan)
        "rds:DescribeDBEngineVersions",
        "rds:DescribeGlobalClusters",
        "rds:DescribeOrderableDBInstanceOptions",
      ]
      resource = "*"
    }

    # ── Secrets Manager: secret management (Terraform) ──
    secretsmanager = {
      actions = [
        "secretsmanager:CreateSecret",
        "secretsmanager:DeleteSecret",
        "secretsmanager:DescribeSecret",
        "secretsmanager:UpdateSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
        "secretsmanager:GetResourcePolicy",
        "secretsmanager:PutResourcePolicy",
        "secretsmanager:DeleteResourcePolicy",
        "secretsmanager:TagResource",
        "secretsmanager:UntagResource",
        "secretsmanager:RotateSecret",
        "secretsmanager:CancelRotateSecret",
      ]
      resource = "*"
    }

    # ── SES: email domain and receipt rules (Terraform) ──
    ses = {
      actions = [
        # Domain identity + DKIM
        "ses:VerifyDomainIdentity",
        "ses:DeleteIdentity",
        "ses:GetIdentityVerificationAttributes",
        "ses:VerifyDomainDkim",
        "ses:GetIdentityDkimAttributes",
        "ses:GetIdentityNotificationAttributes",
        # Mail from
        "ses:SetIdentityMailFromDomain",
        "ses:GetIdentityMailFromDomainAttributes",
        # Configuration set
        "ses:CreateConfigurationSet",
        "ses:DeleteConfigurationSet",
        "ses:DescribeConfigurationSet",
        "ses:CreateConfigurationSetEventDestination",
        "ses:DeleteConfigurationSetEventDestination",
        "ses:UpdateConfigurationSetEventDestination",
        # Receipt rules
        "ses:CreateReceiptRuleSet",
        "ses:DeleteReceiptRuleSet",
        "ses:DescribeReceiptRuleSet",
        "ses:CreateReceiptRule",
        "ses:DeleteReceiptRule",
        "ses:DescribeReceiptRule",
        "ses:UpdateReceiptRule",
        "ses:SetActiveReceiptRuleSet",
        # Quota (Terraform reads)
        "ses:GetSendQuota",
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
        "wafv2:GetLoggingConfiguration",
        "wafv2:PutLoggingConfiguration",
        "wafv2:DeleteLoggingConfiguration",
        "wafv2:AssociateWebACL",
        "wafv2:DisassociateWebACL",
        "wafv2:GetWebACLForResource",
        "wafv2:ListResourcesForWebACL",
        "wafv2:TagResource",
        "wafv2:UntagResource",
        "wafv2:ListTagsForResource",
      ]
      resource = "*"
    }

    # ── Route53: hosted zones + DNS records (Terraform + deploy) ──
    route53 = {
      actions = [
        # Hosted zone CRUD (Terraform)
        "route53:CreateHostedZone",
        "route53:DeleteHostedZone",
        "route53:GetHostedZone",
        "route53:ListHostedZones",
        "route53:UpdateHostedZoneComment",
        # Records (Terraform + deploy-docs)
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets",
        "route53:GetChange",
        # Tags (Terraform)
        "route53:ListTagsForResource",
        "route53:ChangeTagsForResource",
      ]
      resource = "*"
    }

    # ── Location Service: place index (Terraform) ──
    location-service = {
      actions = [
        "geo:CreatePlaceIndex",
        "geo:DeletePlaceIndex",
        "geo:DescribePlaceIndex",
        "geo:UpdatePlaceIndex",
        "geo:TagResource",
        "geo:UntagResource",
        "geo:ListTagsForResource",
      ]
      resource = "*"
    }

    # ── Timestream: database + table (Terraform) ──
    timestream = {
      actions = [
        "timestream:CreateDatabase",
        "timestream:DeleteDatabase",
        "timestream:DescribeDatabase",
        "timestream:UpdateDatabase",
        "timestream:CreateTable",
        "timestream:DeleteTable",
        "timestream:DescribeTable",
        "timestream:UpdateTable",
        "timestream:TagResource",
        "timestream:UntagResource",
        "timestream:ListTagsForResource",
        "timestream:DescribeEndpoints",
      ]
      resource = "*"
    }

    # ── Kinesis: data stream (Terraform) ──
    kinesis = {
      actions = [
        "kinesis:CreateStream",
        "kinesis:DeleteStream",
        "kinesis:DescribeStream",
        "kinesis:DescribeStreamSummary",
        "kinesis:IncreaseStreamRetentionPeriod",
        "kinesis:DecreaseStreamRetentionPeriod",
        "kinesis:UpdateShardCount",
        "kinesis:AddTagsToStream",
        "kinesis:RemoveTagsFromStream",
        "kinesis:ListTagsForStream",
      ]
      resource = "*"
    }

    # ── IoT Core: topic rules + policies + logging (Terraform) ──
    iot = {
      actions = [
        # Topic rules
        "iot:CreateTopicRule",
        "iot:DeleteTopicRule",
        "iot:GetTopicRule",
        "iot:ReplaceTopicRule",
        # Policies
        "iot:CreatePolicy",
        "iot:DeletePolicy",
        "iot:GetPolicy",
        "iot:ListPolicyVersions",
        "iot:DeletePolicyVersion",
        "iot:CreatePolicyVersion",
        # Logging
        "iot:SetLoggingOptions",
        "iot:GetLoggingOptions",
        "iot:SetV2LoggingOptions",
        "iot:GetV2LoggingOptions",
        # Tags
        "iot:TagResource",
        "iot:UntagResource",
        "iot:ListTagsForResource",
        # Endpoint (data source)
        "iot:DescribeEndpoint",
      ]
      resource = "*"
    }

    # ── Cognito: identity pools only (Terraform) ──
    # Note: cognito-idp (User Pools) removed — no User Pool resources exist
    cognito = {
      actions = [
        "cognito-identity:CreateIdentityPool",
        "cognito-identity:DeleteIdentityPool",
        "cognito-identity:DescribeIdentityPool",
        "cognito-identity:UpdateIdentityPool",
        "cognito-identity:SetIdentityPoolRoles",
        "cognito-identity:GetIdentityPoolRoles",
        "cognito-identity:TagResource",
        "cognito-identity:UntagResource",
        "cognito-identity:ListTagsForResource",
      ]
      resource = "*"
    }

    # ── Terraform backend: resource-scoped state access ──
    terraform-backend = {
      actions = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
      ]
      resource = [
        "arn:aws:s3:::open-jii-terraform-state-${var.environment}",
        "arn:aws:s3:::open-jii-terraform-state-${var.environment}/*",
        "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/terraform-state-lock",
      ]
    }

    # ── SSM: parameter management (Terraform) + deploy config reads ──
    ssm = {
      actions = [
        # Parameter CRUD (Terraform)
        "ssm:PutParameter",
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:DeleteParameter",
        "ssm:DescribeParameters",
        "ssm:AddTagsToResource",
        "ssm:RemoveTagsFromResource",
        "ssm:ListTagsForResource",
        # Deploy (get-infrastructure-config composite action)
        "ssm:GetParametersByPath",
      ]
      resource = "*"
    }

    # ── ALB: load balancer management (Terraform) ──
    alb = {
      actions = [
        # Load balancer
        "elasticloadbalancing:CreateLoadBalancer",
        "elasticloadbalancing:DeleteLoadBalancer",
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:ModifyLoadBalancerAttributes",
        "elasticloadbalancing:DescribeLoadBalancerAttributes",
        # Target groups
        "elasticloadbalancing:CreateTargetGroup",
        "elasticloadbalancing:DeleteTargetGroup",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:ModifyTargetGroup",
        "elasticloadbalancing:DescribeTargetGroupAttributes",
        "elasticloadbalancing:ModifyTargetGroupAttributes",
        # Listeners
        "elasticloadbalancing:CreateListener",
        "elasticloadbalancing:DeleteListener",
        "elasticloadbalancing:DescribeListeners",
        "elasticloadbalancing:ModifyListener",
        # Listener rules
        "elasticloadbalancing:CreateRule",
        "elasticloadbalancing:DeleteRule",
        "elasticloadbalancing:DescribeRules",
        "elasticloadbalancing:ModifyRule",
        # Tags
        "elasticloadbalancing:AddTags",
        "elasticloadbalancing:RemoveTags",
        "elasticloadbalancing:DescribeTags",
        # Health (deploy verification)
        "elasticloadbalancing:DescribeTargetHealth",
      ]
      resource = "*"
    }

    # ── EventBridge: rules + targets (Terraform) ──
    eventbridge = {
      actions = [
        "events:PutRule",
        "events:DeleteRule",
        "events:DescribeRule",
        "events:ListRules",
        "events:PutTargets",
        "events:RemoveTargets",
        "events:ListTargetsByRule",
        "events:TagResource",
        "events:UntagResource",
        "events:ListTagsForResource",
      ]
      resource = "*"
    }

    # ── ACM: certificate management (Terraform) ──
    acm = {
      actions = [
        "acm:RequestCertificate",
        "acm:DeleteCertificate",
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "acm:GetCertificate",
        "acm:AddTagsToCertificate",
        "acm:RemoveTagsFromCertificate",
        "acm:ListTagsForCertificate",
      ]
      resource = "*"
    }

    # ── Service Discovery: Cloud Map namespace + service (Terraform) ──
    servicediscovery = {
      actions = [
        "servicediscovery:CreatePrivateDnsNamespace",
        "servicediscovery:DeleteNamespace",
        "servicediscovery:GetNamespace",
        "servicediscovery:ListNamespaces",
        "servicediscovery:GetOperation",
        "servicediscovery:CreateService",
        "servicediscovery:DeleteService",
        "servicediscovery:GetService",
        "servicediscovery:ListServices",
        "servicediscovery:UpdateService",
        "servicediscovery:TagResource",
        "servicediscovery:UntagResource",
        "servicediscovery:ListTagsForResource",
      ]
      resource = "*"
    }

    # ── Application Auto Scaling: ECS scaling (Terraform) ──
    autoscaling = {
      actions = [
        "application-autoscaling:RegisterScalableTarget",
        "application-autoscaling:DeregisterScalableTarget",
        "application-autoscaling:DescribeScalableTargets",
        "application-autoscaling:PutScalingPolicy",
        "application-autoscaling:DeleteScalingPolicy",
        "application-autoscaling:DescribeScalingPolicies",
        "application-autoscaling:TagResource",
        "application-autoscaling:UntagResource",
        "application-autoscaling:ListTagsForResource",
      ]
      resource = "*"
    }

    sts = {
      actions = [
        "sts:GetCallerIdentity",
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
        "grafana:DescribeWorkspaceConfiguration",
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
        "cloudtrail:ListTags",
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

  # Split into managed policies (AWS allows max 10 managed per role, 6,144 chars each)
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

# Managed policies instead of inline — AWS inline limit is 10,240 chars
# combined per role, which enumerated actions exceed. Managed policies
# allow 6,144 chars each × 10 per role = 61,440 chars total capacity.
resource "aws_iam_policy" "oidc_role_policies" {
  for_each = local.policy_parts

  name = "${var.role_name}Policy${each.key}"
  path = "/"

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = each.value
  })
}

resource "aws_iam_role_policy_attachment" "oidc_role_policy_attachments" {
  for_each = local.policy_parts

  role       = aws_iam_role.oidc_role.name
  policy_arn = aws_iam_policy.oidc_role_policies[each.key].arn
}
