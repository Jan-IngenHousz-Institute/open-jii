data "aws_caller_identity" "current" {}

# AWS Managed Policies for Full Access to all resources
locals {
  aws_managed_policies = [
    "AmazonEC2FullAccess",
    "AmazonVPCFullAccess",
    "AmazonS3FullAccess",
    "CloudFrontFullAccess",
    "AmazonTimestreamFullAccess",
    "AmazonKinesisFullAccess",
    "AWSIoTFullAccess",
    "IAMFullAccess",
    "AmazonDynamoDBFullAccess",
    "AmazonCognitoPowerUser",
    "AmazonRDSFullAccess",
    "CloudWatchFullAccess",
    "AmazonEC2ContainerRegistryFullAccess",
    "AmazonECS_FullAccess",
    "AWSLambda_FullAccess",
    "AmazonSQSFullAccess",
    "AmazonRoute53FullAccess",
    "SecretsManagerReadWrite",
    "AmazonSESFullAccess",
    "AmazonSSMFullAccess",
    "AWSWAFFullAccess",
    "AmazonLocationFullAccess",
    "ElasticLoadBalancingFullAccess",
  ]
}

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
              "repo:${var.repository}:pull_request"
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

resource "aws_iam_role_policy_attachment" "oidc_managed_policies" {
  for_each = toset(local.aws_managed_policies)
  role       = aws_iam_role.oidc_role.name
  policy_arn = "arn:aws:iam::aws:policy/${each.value}"
}
