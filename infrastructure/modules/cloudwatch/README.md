# 📊 CloudWatch Logging Module

This module provisions **AWS CloudWatch** resources to enable logging for IoT devices in the OpenJII Platform. It creates IAM roles and policies necessary for IoT Core to write logs to CloudWatch.

## 📖 Overview

AWS CloudWatch enables comprehensive **monitoring and observability** for IoT workloads. This module sets up an **IAM role** for IoT logging to CloudWatch, allowing IoT Core to send logs and diagnostic information.

```mermaid
graph TD;
    %% Main component groups with better routing
    subgraph "IoT Logging & Monitoring"
        A[IoT Devices]:::device -->|Generate Logs| B[AWS IoT Core]:::iot
        B ==>|Assumes Role| R[CloudWatch Logging Role]:::iam
        R -.->|Enables| L[CloudWatch Logs]:::cloudwatch
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
    classDef iam fill:#DD344C,stroke:#B32B3D,color:white,stroke-width:2px;

    %% Custom link styles for better visual hierarchy
    linkStyle 0 stroke:#333,stroke-width:1.5px;
    linkStyle 1 stroke:#DD344C,stroke-width:1.5px;
    linkStyle 2 stroke:#666,stroke-width:1.5px,stroke-dasharray: 3 3;
    linkStyle 3,4 stroke:#DD344C,stroke-width:1.5px;
    linkStyle 5 stroke:#DD344C,stroke-width:1.5px;
```

## 🛠 Resources Used

| Resource         | Description                                            | Documentation                                                                                            |
| ---------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `aws_iam_role`   | IAM role for IoT to write logs to CloudWatch           | [AWS IAM Role](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role)     |
| `aws_iam_policy` | IAM policy defining allowed CloudWatch logging actions | [AWS IAM Policy](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_policy) |

## ⚙️ Usage

To deploy this CloudWatch module, include the following Terraform configuration:

```hcl
module "cloudwatch" {
  source                 = "../../modules/cloudwatch"
  aws_region             = "eu-central-1"
  log_retention_days     = 60
  cloudwatch_role_name   = "iot-cloudwatch-role"
  cloudwatch_policy_name = "iot-cloudwatch-policy"
}
```

## 🔑 Inputs

| Name                   | Description                         | Type     | Default | Required |
| ---------------------- | ----------------------------------- | -------- | ------- | -------- |
| aws_region             | AWS region for CloudWatch resources | `string` | n/a     | ✅ Yes   |
| log_retention_days     | Number of days to retain logs       | `number` | 30      | ❌ No    |
| cloudwatch_role_name   | Name for the CloudWatch IAM role    | `string` | n/a     | ✅ Yes   |
| cloudwatch_policy_name | Name for the CloudWatch IAM policy  | `string` | n/a     | ✅ Yes   |

## 📤 Outputs

| Name                    | Description                                |
| ----------------------- | ------------------------------------------ |
| iot_cloudwatch_role_arn | ARN of the IAM role for CloudWatch logging |
