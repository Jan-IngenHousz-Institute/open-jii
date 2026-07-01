locals {
  provisioning_template_name = "open-jii-${var.environment}-fleet-provisioning"
}

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

resource "aws_iot_policy" "claim_cert_policy" {
  name = "open_jii_${var.environment}_claim_cert_policy"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["iot:Connect"]
        Resource = "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:client/$${iot:ClientId}"
      },
      {
        Effect = "Allow"
        Action = ["iot:Publish", "iot:Receive"]
        Resource = [
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/$$aws/certificates/create/*",
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topic/$$aws/provisioning-templates/${local.provisioning_template_name}/provision/*",
        ]
      },
      {
        Effect = "Allow"
        Action = ["iot:Subscribe"]
        Resource = [
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topicfilter/$$aws/certificates/create/*",
          "arn:aws:iot:${var.aws_region}:${data.aws_caller_identity.current.account_id}:topicfilter/$$aws/provisioning-templates/${local.provisioning_template_name}/provision/*",
        ]
      }
    ]
  })
}


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

resource "aws_iot_certificate" "claim_cert" {
  active = true
}

resource "aws_iot_policy_attachment" "claim_cert_policy" {
  policy = aws_iot_policy.claim_cert_policy.name
  target = aws_iot_certificate.claim_cert.arn
}

resource "aws_secretsmanager_secret" "claim_cert" {
  name                    = "open-jii/${var.environment}/iot/claim-certificate"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "claim_cert" {
  secret_id = aws_secretsmanager_secret.claim_cert.id
  secret_string = jsonencode({
    certificate_pem = aws_iot_certificate.claim_cert.certificate_pem
    private_key     = aws_iot_certificate.claim_cert.private_key
    certificate_id  = aws_iot_certificate.claim_cert.id
    certificate_arn = aws_iot_certificate.claim_cert.arn
  })
}

resource "aws_iam_role" "fleet_provisioning" {
  name = "open_jii_${var.environment}_fleet_provisioning_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "iot.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "fleet_provisioning" {
  role       = aws_iam_role.fleet_provisioning.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSIoTThingsRegistration"
}

resource "aws_iot_provisioning_template" "fleet" {
  name                  = local.provisioning_template_name
  description           = "Fleet provisioning for openJII IoT devices"
  provisioning_role_arn = aws_iam_role.fleet_provisioning.arn
  enabled               = true

  pre_provisioning_hook {
    target_arn      = var.provisioning_lambda_arn
    payload_version = "2020-04-01"
  }

  template_body = jsonencode({
    Parameters = {
      SerialNumber = { Type = "String" }
      DeviceClass  = { Type = "String" }
      AWS          = { Type = "String" }
    }
    Resources = {
      thing = {
        Type = "AWS::IoT::Thing"
        Properties = {
          ThingName = {
            "Fn::Join" = ["", [{ Ref = "DeviceClass" }, "-", { Ref = "SerialNumber" }]]
          }
          AttributePayload = {
            serial_number = { Ref = "SerialNumber" }
            device_class  = { Ref = "DeviceClass" }
          }
        }
        OverrideSettings = {
          AttributePayload = "MERGE"
          ThingGroups      = "DO_NOTHING"
          ThingTypeName    = "DO_NOTHING"
        }
      }
      certificate = {
        Type = "AWS::IoT::Certificate"
        Properties = {
          CertificateId = { Ref = "AWS::IoT::Certificate::Id" }
          Status        = "Active"
        }
      }
      policy = {
        Type = "AWS::IoT::Policy"
        Properties = {
          PolicyName = aws_iot_policy.provisioned_device_policy.name
        }
      }
    }
  })
}

# Allow IoT Core to invoke the pre-provisioning Lambda
resource "aws_lambda_permission" "fleet_provisioning_hook" {
  statement_id  = "AllowIoTFleetProvisioningInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.provisioning_lambda_arn
  principal     = "iot.amazonaws.com"
  source_arn    = aws_iot_provisioning_template.fleet.arn
}
