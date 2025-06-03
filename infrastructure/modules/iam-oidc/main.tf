resource "aws_iam_openid_connect_provider" "github" {
  url             = var.oidc_provider_url
  client_id_list  = var.client_id_list
  thumbprint_list = var.thumbprint_list
}

resource "aws_iam_role" "oidc_role" {
  name = var.role_name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.repository}:ref:refs/heads/${var.branch}"
          }
        }
      }
    ]
  })
}

resource "aws_iam_policy" "oidc_role_policy" {
  name        = "GitHubActionsAccess"
  description = "Policy for GitHub Actions OIDC role with permissions for VPC, S3, CloudFront, Timestream, Kinesis, IoT, and IAM actions."
  policy = jsonencode({
    "Statement" : [
      {
        Sid    = "EC2Permissions"
        Effect = "Allow"
        Action = [
          "ec2:CreateVpc",
          "ec2:DeleteVpc",
          "ec2:DescribeVpcs",
          "ec2:CreateSubnet",
          "ec2:DeleteSubnet",
          "ec2:DescribeSubnets",
          "ec2:CreateInternetGateway",
          "ec2:AttachInternetGateway",
          "ec2:DeleteInternetGateway",
          "ec2:DescribeInternetGateways",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeRouteTables",
          "ec2:DescribeAddressesAttribute",
          "ec2:CreateRouteTable",
          "ec2:AssociateRouteTable",
          "ec2:DisassociateRouteTable",
          "ec2:DeleteRouteTable",
          "ec2:CreateVpcEndpoint",
          "ec2:DescribeVpcEndpoints",
          "ec2:DeleteVpcEndpoint",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeVpcAttribute",
          "ec2:DescribeAddresses",
          "ec2:DescribeNatGateways",
          "ec2:DescribePrefixLists",
          "ec2:DescribeNetworkInterfaces"
        ],
        "Effect" : "Allow",
        "Resource" : "*",
        "Sid" : "EC2Permissions"
      },
      {
        Sid    = "S3Permissions"
        Effect = "Allow"
        Action = [
          "s3:CreateBucket",
          "s3:DeleteBucket",
          "s3:ListBucket",
          "s3:GetBucketPolicy",
          "s3:PutBucketPolicy",
          "s3:DeleteBucketPolicy",
          "s3:PutBucketAcl",
          "s3:GetBucketAcl",
          "s3:DeleteObject",
          "s3:PutObject",
          "s3:GetObject",
          "s3:GetBucketCORS",
          "s3:GetBucketWebsite",
          "s3:GetBucketVersioning",
          "s3:GetAccelerateConfiguration",
          "s3:GetBucketRequestPayment",
          "s3:GetBucketLogging",
          "s3:GetLifecycleConfiguration",
          "s3:GetReplicationConfiguration",
          "s3:GetEncryptionConfiguration",
          "s3:GetBucketObjectLockConfiguration",
          "s3:GetBucketTagging",
          "s3:GetBucketOwnershipControls",
          "s3:GetBucketPublicAccessBlock"
        ],
        "Effect" : "Allow",
        "Resource" : "*",
        "Sid" : "S3Permissions"
      },
      {
        Sid    = "CloudFrontPermissions"
        Effect = "Allow"
        Action = [
          "cloudfront:CreateDistribution",
          "cloudfront:UpdateDistribution",
          "cloudfront:DeleteDistribution",
          "cloudfront:GetDistribution",
          "cloudfront:ListDistributions",
          "cloudfront:GetOriginAccessControl",
          "cloudfront:ListTagsForResource"
        ],
        "Effect" : "Allow",
        "Resource" : "*",
        "Sid" : "CloudFrontPermissions"
      },
      {
        Sid    = "TimestreamPermissions"
        Effect = "Allow"
        Action = [
          "timestream:CreateDatabase",
          "timestream:DescribeDatabase",
          "timestream:DeleteDatabase",
          "timestream:CreateTable",
          "timestream:DescribeTable",
          "timestream:DeleteTable",
          "timestream:DescribeEndpoints",
          "timestream:ListTagsForResource"
        ],
        "Effect" : "Allow",
        "Resource" : "*",
        "Sid" : "TimestreamPermissions"
      },
      {
        Sid    = "KinesisPermissions"
        Effect = "Allow"
        Action = [
          "kinesis:CreateStream",
          "kinesis:DescribeStream",
          "kinesis:DeleteStream",
          "kinesis:ListStreams",
          "kinesis:PutRecord",
          "kinesis:PutRecords",
          "kinesis:DescribeStreamSummary",
          "kinesis:ListTagsForStream"
        ],
        "Effect" : "Allow",
        "Resource" : "*",
        "Sid" : "KinesisPermissions"
      },
      {
        Sid    = "IoTCorePermissions"
        Effect = "Allow"
        Action = [
          "iot:CreateThing",
          "iot:DeleteThing",
          "iot:DescribeThing",
          "iot:UpdateThing",
          "iot:ListThings",
          "iot:GetPolicy",
          "iot:ListTagsForResource",
          "iot:GetV2LoggingOptions",
          "iot:ListTopicRules",
          "iot:GetTopicRule"
        ],
        "Effect" : "Allow",
        "Resource" : "*",
        "Sid" : "IoTCorePermissions"
      },
      {
        Sid    = "IAMPermissionsForIoTAndDatabricks"
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:DeleteRole",
          "iam:AttachRolePolicy",
          "iam:PutRolePolicy",
          "iam:PassRole",
          "iam:GetPolicy",
          "iam:GetRole",
          "iam:GetOpenIDConnectProvider",
          "iam:GetPolicyVersion",
          "iam:ListRolePolicies",
          "iam:GetRolePolicy",
          "iam:ListAttachedRolePolicies"
        ],
        "Effect" : "Allow",
        "Resource" : "*",
        "Sid" : "IAMPermissionsForIoTAndDatabricks"
      },
      {
        Sid    = "DynamoDBs3lock"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DescribeTable",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeContinuousBackups",
          "dynamodb:DescribeTimeToLive",
          "dynamodb:ListTagsOfResource"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/terraform-state-lock"
      },
      {
        Sid    = "CognitoPools"
        Effect = "Allow"
        Action = [
          "cognito-identity:DescribeIdentityPool",
          "cognito-identity:ListIdentityPools",
          "cognito-identity:GetIdentityPoolRoles",
          "cognito-identity:LookupDeveloperIdentity"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECRPermissions"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:ListImages",
          "ecr:DescribeRepositories",
          "ecr:TagResource"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECSPermissions"
        Effect = "Allow"
        Action = [
          "ecs:RegisterTaskDefinition",
          "ecs:DeregisterTaskDefinition",
          "ecs:DescribeTaskDefinition",
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:CreateService",
          "ecs:DeleteService",
          "ecs:ListClusters",
          "ecs:DescribeClusters",
          "ecr:DescribeImages",
          "ecr:ListTagsForResource",
          "ecs:ListServices"
        ]
        Resource = "*"
      }
    ],
    "Version" : "2012-10-17"
  })
}

resource "aws_iam_role_policy_attachment" "oidc_role_policy_attachment" {
  role       = aws_iam_role.oidc_role.name
  policy_arn = aws_iam_policy.oidc_role_policy.arn
}
