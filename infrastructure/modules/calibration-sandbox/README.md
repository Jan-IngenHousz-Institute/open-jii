# 🔬 Calibration Sandbox Module

This module orchestrates **isolated Lambda-based execution of calibration scripts**. It composes an ECR repository, VPC flow logs, and the calibration Lambda into a single deployable unit.

## 📖 Overview

A calibration run is a bench session: an operator drives instruments from the browser, the readings are posted to the backend, and the definition's fitting script turns them into coefficients. That script is author-supplied, so it runs here rather than in the backend process.

The module wires together three sub-modules:

1. **ECR** — one container image registry for the Python image
2. **VPC Flow Logs** — subnet-level traffic auditing for the isolated subnets
3. **Calibration Lambda** — IAM role, function, CloudWatch logs, invoke policy

```mermaid
graph LR
    subgraph ENV["Environment (dev / prod)"]
        direction TB
        COMPUTE["var.memory = 1024<br/>var.timeout = 45"]
        ECR_CFG["var.image_tag_mutability<br/>var.force_delete"]
        VPC_CFG["var.isolated_subnet_ids<br/>var.lambda_sg_id"]
    end

    subgraph RUNNER["calibration-sandbox module"]
        direction TB
        ECR_MOD["📦 module.ecr"]
        FLOW["🪵 module.flow_logs"]
        LAMBDA["λ module.lambda"]
    end

    BACKEND["🖥️ Backend task role"]

    ECR_CFG --> ECR_MOD
    VPC_CFG --> FLOW
    COMPUTE --> LAMBDA
    ECR_MOD -- "repository_url / arn" --> LAMBDA
    FLOW -- "log_group_name" --> LAMBDA
    LAMBDA -- "invoke_policy_arn" --> BACKEND
```

## 🔒 Isolation

The function runs in the isolated subnets: no internet gateway, no NAT. Its security group allows no inbound traffic and egress only on 443 to the VPC CIDR, which reaches the ECR API, ECR DKR and CloudWatch Logs endpoints and nothing else. On top of that the execution role carries an explicit deny for every data-bearing service, so a script cannot read the database, a bucket, or a secret even if it tries.

Unlike the macro sandbox, retries are disabled. A calibration run is requested by a person standing at a bench and is recorded against one device, so a retried invoke would write a second run for a single request.

## ⏱️ Timeout

`handler.py` stops a fitting script at 30 seconds and returns its own error describing what happened. The function timeout is deliberately above that, so the graceful failure reaches the operator instead of the Lambda being killed mid-run.

## 🔗 Wiring

The environment passes `function_name` to the backend as `AWS_LAMBDA_CALIBRATION_SANDBOX_FUNCTION_NAME` and attaches `invoke_policy_arn` to the backend task role. Until both exist, the backend refuses every calibration run with "Calibration sandbox Lambda is not configured" rather than failing to boot.

## 📦 Image deployment

Terraform creates the function pointing at `:latest` and then ignores `image_uri`. `.github/workflows/deploy-calibration-sandbox.yml` builds `apps/calibration-sandbox/functions/python/Dockerfile`, pushes it tagged with the commit SHA, and calls `aws lambda update-function-code`.
