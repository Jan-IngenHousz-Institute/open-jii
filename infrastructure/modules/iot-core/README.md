# 📡 IoT Core Module

This module provisions **AWS IoT Core** resources to allow MultispeQ devices to securely interface with the OpenJII Platform. In addition to storing data in **Timestream** for querying, the module also routes data to a **Kinesis Data Stream** for real‑time processing and integrates with **CloudWatch** for comprehensive logging and monitoring.

## 📖 Overview

AWS IoT Core enables **secure communication** between IoT devices and AWS cloud services. This module sets up an **IoT policy**, **IAM roles and policies**, and an **IoT Topic Rule** that routes device messages to both a **Timestream database** and a **Kinesis Data Stream**. It also configures **IoT Core logging** through CloudWatch for monitoring and troubleshooting.

```mermaid
graph TD;
    %% Improved layout with better routing
    subgraph "MultispeQ Data Pipeline"
        A[MultispeQ Device]:::device -->|MQTT Message| B[AWS IoT Core]:::iot;
        B -->|Evaluates Rule| C[IoT Topic Rule]:::iot;

        %% Clearer role assumption flow
        C ==>|Assumes Role| TR[Timestream Role]:::iam;
        C ==>|Assumes Role| KR[Kinesis Role]:::iam;
        B ==>|Assumes Role| LR[CloudWatch Logging Role]:::iam;

        %% Data flow destinations with curved connections
        TR -.->|Writes Data| D[AWS Timestream]:::timestream;
        KR -.->|Streams Data| E[Kinesis Data Stream]:::kinesis;
        LR -.->|Sends Logs| F[CloudWatch Logs]:::cloudwatch;
    end

    subgraph "Security & Access Control"
        G[AWS IAM]:::iam;
        G -->|Creates| P[IoT Policies]:::iam;
        G -->|Creates| TR;
        G -->|Creates| KR;
        G -->|Creates| LR;
        P ====>|Controls| B;
    end

    %% Define styles for different component types
    classDef device fill:#85C1E9,stroke:#2874A6,color:black,stroke-width:2px;
    classDef iot fill:#7AA116,stroke:#5A7512,color:white,stroke-width:2px;
    classDef timestream fill:#2175B5,stroke:#195A8C,color:white,stroke-width:2px;
    classDef kinesis fill:#FF9900,stroke:#C77700,color:white,stroke-width:2px;
    classDef cloudwatch fill:#FF4F8B,stroke:#CC3F6E,color:white,stroke-width:2px;
    classDef iam fill:#DD344C,stroke:#B32B3D,color:white,stroke-width:2px;

    %% Custom link styles for better visual hierarchy
    linkStyle 0,1 stroke:#333,stroke-width:1.5px;
    linkStyle 2,3,4 stroke:#DD344C,stroke-width:1.5px,stroke-dasharray: 5 5;
    linkStyle 5,6,7 stroke:#666,stroke-width:1.5px,stroke-dasharray: 3 3;
    linkStyle 8,9,10,11 stroke:#DD344C,stroke-width:1.5px;
    linkStyle 12 stroke:#7AA116,stroke-width:2px;
```

## 🛠 Resources Used

| Resource                  | Description                                                         | Documentation                                                                                                              |
| ------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `aws_iot_policy`          | Defines permissions for IoT devices                                 | [AWS IoT Policy](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iot_policy)                   |
| `aws_iam_role`            | IAM roles for IoT to write to Timestream and Kinesis                | [AWS IAM Role](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role)                       |
| `aws_iam_policy`          | IAM policies defining allowed actions on Timestream and Kinesis     | [AWS IAM Policy](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy)                   |
| `aws_iot_topic_rule`      | MQTT rule to filter and route IoT messages to multiple destinations | [AWS IoT Topic Rule](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iot_topic_rule)           |
| `aws_iot_logging_options` | Configures IoT Core's CloudWatch logging options                    | [AWS IoT Logging Options](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iot_logging_options) |

## ⚙️ Usage

To deploy this IoT Core module, include the following Terraform configuration:

```hcl
module "cloudwatch" {
  source                 = "../../modules/cloudwatch"
  aws_region             = "eu-central-1"
  cloudwatch_role_name   = "iot-cloudwatch-role"
  cloudwatch_policy_name = "iot-cloudwatch-policy"
  iot_alerts_topic_name  = "iot-connection-alerts"
}

module "your_iot_core" {
  source                     = "../../modules/iot-core"
  policy_name                = "iot-policy"
  iot_timestream_role_name   = "iot-timestream-role"
  iot_timestream_policy_name = "iot-timestream-policy"
  iot_kinesis_role_name      = "iot-kinesis-role"
  iot_kinesis_policy_name    = "iot-kinesis-policy"
  rule_name                  = "iot-dual-rule"
  topic_filter               = "sensors/+/data"
  timestream_database        = "sensor_data_db"
  timestream_table           = "device_metrics"
  kinesis_stream_name        = "iot-kinesis-stream"
  kinesis_stream_arn         = "arn:aws:kinesis:us-east-1:123456789012:stream/iot-kinesis-stream"
  cloudwatch_role_arn        = module.cloudwatch.iot_cloudwatch_role_arn
  default_log_level          = "INFO"
}
```

## 🔑 Inputs

| Name                       | Description                                                               | Type     | Default | Required |
| -------------------------- | ------------------------------------------------------------------------- | -------- | ------- | -------- |
| policy_name                | Name for the IoT policy                                                   | `string` | n/a     | ✅ Yes   |
| iot_timestream_role_name   | Name for the IAM role for IoT to write to Timestream                      | `string` | n/a     | ✅ Yes   |
| iot_timestream_policy_name | Name for the IAM policy for IoT to write to Timestream                    | `string` | n/a     | ✅ Yes   |
| iot_kinesis_role_name      | Name for the IAM role for IoT to write to Kinesis                         | `string` | n/a     | ✅ Yes   |
| iot_kinesis_policy_name    | Name for the IAM policy for IoT to write to Kinesis                       | `string` | n/a     | ✅ Yes   |
| rule_name                  | Name for the IoT topic rule                                               | `string` | n/a     | ✅ Yes   |
| topic_filter               | MQTT topic filter for the IoT rule                                        | `string` | n/a     | ❌ No    |
| timestream_database        | Name of the Timestream database                                           | `string` | n/a     | ✅ Yes   |
| timestream_table           | Name of the Timestream table                                              | `string` | n/a     | ✅ Yes   |
| kinesis_stream_name        | Name of the Kinesis Data Stream                                           | `string` | n/a     | ✅ Yes   |
| kinesis_stream_arn         | ARN of the Kinesis Data Stream                                            | `string` | n/a     | ✅ Yes   |
| default_log_level          | Logging level for IoT Core (ERROR, WARN, INFO, DEBUG, or DISABLED)        | `string` | "INFO"  | ❌ No    |
| cloudwatch_role_arn        | ARN of the IAM role for IoT Core logging created by the cloudwatch module | `string` | n/a     | ✅ Yes   |

## 📤 Outputs

| Name                    | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| iot_policy_arn          | ARN of the IoT policy                                        |
| iot_timestream_role_arn | ARN of the IAM role allowing IoT Core to write to Timestream |
| iot_kinesis_role_arn    | ARN of the IAM role allowing IoT Core to write to Kinesis    |
| iot_topic_rule_name     | Name of the IoT Topic Rule                                   |

## 🌍 Notes

- The topic rule listens for messages matching the specified **MQTT topic filter**.
- The rule extracts the **deviceId** from the topic and stores data with this identifier in Timestream.
- Simultaneously, the same message is sent to a Kinesis Data Stream for further processing.
- CloudWatch logging is enabled with the specified log level for monitoring and troubleshooting.
- **IAM Role Architecture**:
  - **Incoming communication**: IoT policies control device communication permissions (connect, publish, subscribe)
  - **Outgoing communication**: Separate IAM roles for each destination service:
    - Timestream role allows IoT Core to write data to Timestream
    - Kinesis role allows IoT Core to stream data to Kinesis
    - CloudWatch role allows IoT Core to send logs to CloudWatch
  - IoT Core assumes these roles when executing rules or performing logging
