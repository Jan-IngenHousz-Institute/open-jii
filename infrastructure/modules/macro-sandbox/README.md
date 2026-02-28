# 🏃 Macro Sandbox Module

This module orchestrates **isolated Lambda-based code execution** for user-submitted macros. It composes ECR repositories, VPC flow logs, and Lambda functions into a single deployable unit — one entry point for the complete macro execution infrastructure.

## 📖 Overview

The macro sandbox is an **orchestrator module** that wires together three sub-modules:

1. **ECR** (×N) — one container image registry per language
2. **VPC Flow Logs** — subnet-level traffic auditing for isolated subnets
3. **Macro Lambda** — IAM roles, Lambda functions, CloudWatch logs, invoke policy

The module is **language-agnostic** — add a new language by adding a key to `var.languages`. No module code changes required.

```mermaid
graph LR
    subgraph ENV["Environment (dev / prod)"]
        direction TB
        LANGS["var.languages<br/><code>python: {memory: 1024, timeout: 65}</code><br/><code>js: {memory: 512, timeout: 65}</code><br/><code>r: {memory: 1024, timeout: 65}</code>"]
        ECR_CFG["var.image_tag_mutability<br/>var.force_delete"]
        VPC_CFG["var.isolated_subnet_ids<br/>var.lambda_sg_id"]
    end

    subgraph RUNNER["macro-sandbox module"]
        direction TB

        subgraph ECR_MOD["module.ecr — for_each = var.languages"]
            ECR_P["📦 ECR python"]
            ECR_J["📦 ECR js"]
            ECR_R["📦 ECR r"]
        end

        FLOW["📊 module.flow_logs<br/>VPC Flow Logs on<br/>isolated subnets"]

        subgraph LAMBDA_MOD["module.lambda (macro-lambda)"]
            ROLE["🔐 IAM Role + 4 policies"]
            FN_P["⚡ Lambda python"]
            FN_J["⚡ Lambda js"]
            FN_R["⚡ Lambda r"]
            INVOKE["📜 Invoke IAM Policy"]
            METRIC["📈 Rejected Traffic Metric"]
        end
    end

    LANGS --> ECR_MOD
    LANGS --> LAMBDA_MOD
    ECR_CFG --> ECR_MOD
    VPC_CFG --> LAMBDA_MOD

    ECR_P -->|"repository_url + arn"| FN_P
    ECR_J -->|"repository_url + arn"| FN_J
    ECR_R -->|"repository_url + arn"| FN_R
    FLOW -->|"log_group_name"| METRIC

    INVOKE -->|"invoke_policy_arn"| BACKEND["🖥 Backend ECS Task"]
    FN_P & FN_J & FN_R -->|"function_names"| GRAFANA["📊 Grafana Dashboard"]
    ECR_P & ECR_J & ECR_R -->|"push images"| CICD["🔄 CI/CD Pipeline"]

    style RUNNER fill:#f9f9f9,stroke:#333,stroke-width:2px,color:#333
    style ECR_MOD fill:#e8f4fc,stroke:#31708f,stroke-width:1px,color:#333
    style LAMBDA_MOD fill:#fdf8e8,stroke:#8a6d3b,stroke-width:1px,color:#333
    style FLOW fill:#eaf6e5,stroke:#3c763d,stroke-width:1px,color:#333
    style ENV fill:#f9f9f9,stroke:#999,stroke-width:1px,stroke-dasharray: 5 5,color:#333
```

## 🛠 Sub-Modules Used

| Module                              | Purpose                                          | Source                     |
| ----------------------------------- | ------------------------------------------------ | -------------------------- |
| [`ecr`](../ecr)                     | Container image registry per language            | `for_each = var.languages` |
| [`vpc-flow-logs`](../vpc-flow-logs) | Traffic auditing on isolated subnets             | Single instance            |
| [`macro-lambda`](../macro-lambda)   | IAM, Lambda functions, CloudWatch, invoke policy | Single instance            |

## ⚙️ Usage

```hcl
module "macro_sandbox" {
  source = "../../modules/macro-sandbox"

  aws_region          = var.aws_region
  environment         = var.environment
  ci_cd_role_arn      = module.iam_oidc.role_arn
  isolated_subnet_ids = module.vpc.isolated_subnets
  lambda_sg_id        = module.vpc.macro_sandbox_lambda_security_group_id

  languages = {
    python = { memory = 1024, timeout = 65 } # numpy/scipy need ~1 GB
    js     = { memory = 512,  timeout = 65 } # Node.js is lightweight
    r      = { memory = 1024, timeout = 65 } # R + jsonlite needs decent memory
  }

  # Dev overrides
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  log_retention_days   = 7

  tags = {
    Environment = var.environment
    Project     = "open-jii"
  }
}

# Grant backend the ability to invoke macro-sandbox functions
resource "aws_iam_role_policy_attachment" "backend_invoke" {
  role       = module.backend_ecs.task_role_name
  policy_arn = module.macro_sandbox.invoke_policy_arn
}
```

### Adding a new language

Add a key to `languages` — that's it:

```hcl
languages = {
  python = { memory = 1024, timeout = 65 }
  js     = { memory = 512,  timeout = 65 }
  r      = { memory = 1024, timeout = 65 }
  rust   = { memory = 256,  timeout = 30 } # new!
}
```

This creates a new ECR repo, Lambda function, CloudWatch log group, and updates all IAM policies automatically.

## 🔑 Inputs

| Name                      | Description                                                   | Type                             | Default       | Required |
| ------------------------- | ------------------------------------------------------------- | -------------------------------- | ------------- | :------: |
| `aws_region`              | AWS region for ECR repositories                               | `string`                         | —             |  ✅ Yes  |
| `environment`             | Environment name (e.g., dev, staging, prod)                   | `string`                         | —             |  ✅ Yes  |
| `ci_cd_role_arn`          | IAM role ARN used by CI/CD to push images to ECR              | `string`                         | —             |  ✅ Yes  |
| `isolated_subnet_ids`     | Isolated subnet IDs where Lambda functions run                | `list(string)`                   | —             |  ✅ Yes  |
| `lambda_sg_id`            | Security group ID for Lambda functions                        | `string`                         | —             |  ✅ Yes  |
| `languages`               | Per-language Lambda config (memory in MB, timeout in seconds) | `map(object({memory, timeout}))` | —             |  ✅ Yes  |
| `image_tag_mutability`    | ECR tag mutability (`MUTABLE` for dev, `IMMUTABLE` for prod)  | `string`                         | `"IMMUTABLE"` |  ❌ No   |
| `force_delete`            | Allow ECR deletion with images (true for dev, false for prod) | `bool`                           | `false`       |  ❌ No   |
| `log_retention_days`      | CloudWatch log retention for Lambda logs (days)               | `number`                         | `7`           |  ❌ No   |
| `flow_log_retention_days` | CloudWatch log retention for VPC flow logs (days)             | `number`                         | `14`          |  ❌ No   |
| `tags`                    | Additional tags for all resources                             | `map(string)`                    | `{}`          |  ❌ No   |

## 📤 Outputs

| Name                | Description                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `function_names`    | Lambda function names keyed by language (e.g., `{ python = "macro-sandbox-python-dev" }`) |
| `invoke_policy_arn` | IAM policy ARN granting `lambda:InvokeFunction` — attach to backend task role            |
