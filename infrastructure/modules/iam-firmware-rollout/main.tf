# Role assumed by the firmware rollout workflow to create AWS IoT Jobs.
#
# Deliberately separate from the shared GithubActionsDeployAccess role: that one
# trusts `pull_request` and any branch ref, so granting it iot:CreateJob would
# let an unreviewed workflow run reach the fleet. Here the only trusted subject
# is the protected GitHub environment, whose required reviewers are the
# authorization for touching devices.

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "firmware_rollout" {
  name = "open_jii_${var.environment}_firmware_rollout"

  # StringEquals on exactly one subject, not StringLike on a pattern list.
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Action    = "sts:AssumeRoleWithWebIdentity",
      Principal = { Federated = var.oidc_provider_arn },
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub" = "repo:${var.repository}:environment:firmware-rollout-${var.environment}"
        }
      }
    }]
  })

  # Rollout polling runs longer than the 1h default session.
  max_session_duration = 7200
}

resource "aws_iam_role_policy" "firmware_rollout" {
  name = "open_jii_${var.environment}_firmware_rollout"
  role = aws_iam_role.firmware_rollout.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        # Exactly what the rollout action invokes, nothing held in reserve.
        # Stopping a bad rollout is the abort config's job, or a human's in the
        # console with their own credentials; this role is assumable only by the
        # workflow, so a cancel grant here would never be the thing used.
        Sid    = "ManageFirmwareJobs",
        Effect = "Allow",
        Action = [
          "iot:CreateJob",
          "iot:DescribeJob",
          "iot:ListJobExecutionsForJob",
        ],
        Resource = [
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:job/*",
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:thing/*",
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:thinggroup/*",
        ]
      },
      {
        Sid      = "ResolveTargetGroup",
        Effect   = "Allow",
        Action   = "iot:ListThingsInThingGroup",
        Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:thinggroup/*"
      },
      {
        # Narrowing a rollout to one device family reads the registry by the
        # deviceType attribute. ListThings is an account-level query and has no
        # per-resource ARN to scope to, so it can only be granted on "*".
        Sid      = "ResolveTargetFamily",
        Effect   = "Allow",
        Action   = "iot:ListThings",
        Resource = "*"
      },
      {
        Sid      = "PublishFirmwareArtifact",
        Effect   = "Allow",
        Action   = ["s3:PutObject", "s3:GetObject"],
        Resource = "${var.firmware_bucket_arn}/*"
      },
      {
        # Required to hand the presign role to Jobs in PresignedUrlConfig.
        Sid      = "PassPresignRole",
        Effect   = "Allow",
        Action   = "iam:PassRole",
        Resource = var.presign_role_arn,
        Condition = {
          StringEquals = { "iam:PassedToService" = "iot.amazonaws.com" }
        }
      }
    ]
  })
}
