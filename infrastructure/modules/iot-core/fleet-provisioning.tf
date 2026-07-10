resource "aws_iot_thing_type" "device_types" {
  for_each = var.device_types

  name = "open-jii-${var.environment}-${each.key}"

  properties {
    description           = each.value.description
    searchable_attributes = each.value.searchable_attributes
  }
}

resource "aws_iot_thing_group" "device_groups" {
  for_each = var.device_groups

  name              = "open-jii-${var.environment}-${each.key}"
  parent_group_name = each.value.parent_group != null ? "open-jii-${var.environment}-${each.value.parent_group}" : null

  properties {
    description = each.value.description
  }
}

# Policy attached to every provisioned device certificate. Controls what the
# device may publish to and subscribe from after it has its unique cert.
resource "aws_iot_policy" "provisioned_device_policy" {
  name = "open_jii_${var.environment}_provisioned_device_policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["iot:Connect"]
        Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:client/$${iot:ClientId}"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Publish"]
        Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/device/data/v1/$${iot:ThingName}/*"
      },
      {
        Effect = "Allow"
        Action = ["iot:Subscribe", "iot:Receive"]
        Resource = [
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topicfilter/device/scripts/v1/*/$${iot:ThingName}",
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/device/scripts/v1/*/$${iot:ThingName}",
        ]
      }
    ]
  })
}

# IAM policy granting the ECS backend task role the IoT operations needed to
# provision devices directly (no Lambda middleman).
resource "aws_iam_policy" "backend_iot_provision" {
  name = "open_jii_${var.environment}_backend_iot_provision"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "iot:CreateThing",
        "iot:DeleteThing",
        "iot:CreateKeysAndCertificate",
        "iot:AttachThingPrincipal",
        "iot:DetachThingPrincipal",
        "iot:AttachPolicy",
        "iot:UpdateCertificate",
        "iot:ListThingPrincipals",
      ]
      Resource = "*"
    }]
  })
}
