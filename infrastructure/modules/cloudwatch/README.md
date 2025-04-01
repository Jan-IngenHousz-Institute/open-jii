# 📊 CloudWatch Monitoring Module

This module provisions **AWS CloudWatch** resources to monitor IoT devices and set up alerting for the OpenJII Platform. It creates IAM roles for logging, configures CloudWatch metric alarms for critical IoT metrics, and establishes an SNS topic for notifications.

## 📖 Overview

AWS CloudWatch enables comprehensive **monitoring and observability** for IoT workloads. This module sets up an **IAM role** for IoT logging to CloudWatch, multiple **CloudWatch alarms** for IoT metrics, and an **SNS topic** for alert notifications when thresholds are exceeded.

```mermaid
graph TD;
    %% Main component groups with better routing
    subgraph "IoT Metrics & Monitoring"
        A[IoT Devices]:::device -->|Generate Metrics| B[AWS IoT Core]:::iot
        B -->|Sends Metrics| C[CloudWatch Metrics]:::cloudwatch
        B ==>|Assumes Role| R[CloudWatch Logging Role]:::iam
        R -.->|Enables| L[CloudWatch Logs]:::cloudwatch
    end

    subgraph "Alarm Configuration"
        C -->|Evaluated by| AM1[Connection Failure Alarm]:::alarm
        C -->|Evaluated by| AM2[Rule Execution Alarm]:::alarm
        C -->|Evaluated by| AM3[Message Throttling Alarm]:::alarm
        C -->|Evaluated by| AM4[Publish Errors Alarm]:::alarm
    end

    subgraph "Alerting System"
        AM1 & AM2 & AM3 & AM4 ==>|Triggers| S[SNS Topic]:::sns
        S -.->|Notifies| N[Administrators]:::user
    end

    %% IAM permissions flow
    subgraph "Access Management"
        I[AWS IAM]:::iam -->|Creates| P[CloudWatch Policy]:::iam
        I -->|Creates| R
        P -->|Attached to| R
    end

    %% Define styles for different component types
    classDef device fill:#85C1E9,stroke:#2874A6,color:black,stroke-width:2px;
    classDef iot fill:#7AA116,stroke:#5A7512,color:white,stroke-width:2px;
    classDef cloudwatch fill:#FF4F8B,stroke:#CC3F6E,color:white,stroke-width:2px;
    classDef alarm fill:#FF9900,stroke:#C77700,color:white,stroke-width:2px;
    classDef sns fill:#9467BD,stroke:#6C4D8E,color:white,stroke-width:2px;
    classDef iam fill:#DD344C,stroke:#B32B3D,color:white,stroke-width:2px;
    classDef user fill:#2ECC71,stroke:#27AE60,color:black,stroke-width:2px;

    %% Custom link styles for better visual hierarchy
    linkStyle 0,1 stroke:#333,stroke-width:1.5px;
    linkStyle 2 stroke:#DD344C,stroke-width:1.5px,stroke-dasharray: 5 5;
    linkStyle 3 stroke:#666,stroke-width:1.5px,stroke-dasharray: 3 3;
    linkStyle 4,5,6,7 stroke:#FF9900,stroke-width:1.5px;
    linkStyle 8 stroke:#9467BD,stroke-width:2px;
    linkStyle 9 stroke:#9467BD,stroke-width:1.5px,stroke-dasharray: 3 3;
    linkStyle 10,11 stroke:#DD344C,stroke-width:1.5px;
    linkStyle 12 stroke:#DD344C,stroke-width:1.5px;
```

## 🛠 Resources Used

| Resource                      | Description                                            | Documentation                                                                                                                      |
| ----------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `aws_iam_role`                | IAM role for IoT to write logs to CloudWatch           | [AWS IAM Role](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role)                               |
| `aws_iam_policy`              | IAM policy defining allowed CloudWatch logging actions | [AWS IAM Policy](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy)                           |
| `aws_sns_topic`               | SNS topic for IoT alerts and notifications             | [AWS SNS Topic](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/sns_topic)                             |
| `aws_cloudwatch_metric_alarm` | CloudWatch alarms for monitoring IoT metrics           | [AWS CloudWatch Metric Alarm](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_metric_alarm) |

## ⚙️ Usage

To deploy this CloudWatch module, include the following Terraform configuration:

```hcl
module "cloudwatch" {
  source                 = "../../modules/cloudwatch"
  aws_region             = "eu-central-1"
  cloudwatch_role_name   = "iot-cloudwatch-role"
  cloudwatch_policy_name = "iot-cloudwatch-policy"
  iot_alerts_topic_name  = "iot-connection-alerts"
}
```

## 🔑 Inputs

| Name                   | Description                           | Type     | Default | Required |
| ---------------------- | ------------------------------------- | -------- | ------- | -------- |
| aws_region             | AWS region for CloudWatch resources   | `string` | n/a     | ✅ Yes   |
| cloudwatch_role_name   | Name for the CloudWatch IAM role      | `string` | n/a     | ✅ Yes   |
| cloudwatch_policy_name | Name for the CloudWatch IAM policy    | `string` | n/a     | ✅ Yes   |
| iot_alerts_topic_name  | Name for the SNS topic for IoT alerts | `string` | n/a     | ✅ Yes   |

## 📤 Outputs

| Name                    | Description                                |
| ----------------------- | ------------------------------------------ |
| iot_cloudwatch_role_arn | ARN of the IAM role for CloudWatch logging |
| iot_alerts_topic_arn    | ARN of the SNS topic for IoT alerts        |

## 🔍 Monitoring Metrics

This module configures the following CloudWatch alarms:

1. **IoT Connection Failure Rate**: Alerts when the rate of connection failures exceeds 10%
2. **IoT Rule Execution Failures**: Alerts when more than 5 rule execution failures occur within 5 minutes
3. **IoT Message Throttling**: Alerts when more than 10 message throttling events occur within 5 minutes
4. **IoT Publish Errors**: Alerts when the rate of publish errors exceeds 5%

All alarms are configured to send notifications to the specified SNS topic when thresholds are exceeded and when returning to normal state.
