# 📡 IoT Core Module

This module provisions **AWS IoT Core** resources to allow JII MultispeQ devices to securely interface with the OpenJII Platform.

## 📖 Overview

AWS IoT Core enables **secure communication** between IoT devices and AWS cloud services. This module sets up an **IoT policy**, an **IAM role**, and an **IoT Topic Rule** that routes device messages to a **Timestream database** for storage and querying.

```mermaid
graph TD;
    subgraph "MultispeQ Data Pipeline"
        A[MultispeQ Device] -->|MQTT Message| B[AWS IoT Core];
        B -->|Evaluates Rule| C[IoT Topic Rule];
        C -->|Stores Data| D[AWS Timestream];
    end
    subgraph "Security & Access Control"
        E[AWS IAM];
        E -.->|Manages Permissions| B;
        E -.->|Grants Access| D;
    end
```

## 🛠 Resources Used

| Resource             | Description                                       | Documentation                                                                                                    |
| -------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `aws_iot_policy`     | Defines permissions for IoT devices               | [AWS IoT Policy](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iot_policy)         |
| `aws_iam_role`       | IAM role allowing IoT Core to write to Timestream | [AWS IAM Role](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role)             |
| `aws_iam_policy`     | IAM policy defining allowed actions on Timestream | [AWS IAM Policy](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy)         |
| `aws_iot_topic_rule` | MQTT rule to filter and route IoT messages        | [AWS IoT Topic Rule](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iot_topic_rule) |

## ⚙️ Usage

To deploy this IoT Core module, include the following Terraform configuration:

```hcl
module "your_iot_core" {
  source                     = "../../modules/iot-core"
  policy_name                = "iot-policy"
  iot_timestream_role_name   = "iot-timestream-role"
  iot_timestream_policy_name = "iot-timestream-policy"
  rule_name                  = "iot-timestream-rule"
  topic_filter               = "sensors/+/data"
  timestream_database        = "sensor_data_db"
  timestream_table           = "device_metrics"
}
```

## 🔑 Inputs

| Name                       | Description                                            | Type     | Default          | Required |
| -------------------------- | ------------------------------------------------------ | -------- | ---------------- | -------- |
| policy_name                | Name for the IoT policy                                | `string` | n/a              | ✅ Yes   |
| iot_timestream_role_name   | Name for the IAM role for IoT to write to Timestream   | `string` | n/a              | ✅ Yes   |
| iot_timestream_policy_name | Name for the IAM policy for IoT to write to Timestream | `string` | n/a              | ✅ Yes   |
| rule_name                  | Name for the IoT topic rule                            | `string` | n/a              | ✅ Yes   |
| topic_filter               | MQTT topic filter for the IoT rule                     | `string` | n/a              | ❌ No    |
| timestream_database        | Name of the Timestream database                        | `string` | n/a              | ✅ Yes   |
| timestream_table           | Name of the Timestream table                           | `string` | n/a              | ✅ Yes   |

## 📤 Outputs

| Name                    | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| iot_policy_arn          | ARN of the IoT policy                                        |
| iot_timestream_role_arn | ARN of the IAM role allowing IoT Core to write to Timestream |


## 🌍 Notes

- The topic rule listens for messages matching the specified **MQTT topic filter**.
- The rule extracts the **deviceId** from the topic and stores data with this identifier.
- AWS IoT Core can be integrated with **Lambda, Kinesis, or SNS** for further event processing.
