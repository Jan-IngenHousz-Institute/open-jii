# λ Calibration Lambda Module

Creates the Lambda function that runs a calibration definition's fitting script, together with its execution role, log group, and the invoke policy the backend task role attaches.

Consumed by [`../calibration-sandbox`](../calibration-sandbox), which supplies the ECR repository and flow log group. It is not meant to be instantiated directly from an environment.

## 🧱 What it creates

| Resource                                | Purpose                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `aws_iam_role.lambda`                   | Execution role                                                          |
| `aws_iam_role_policy.lambda_logs`       | Write to this function's log group only                                 |
| `aws_iam_role_policy.lambda_vpc`        | ENI management, required to run in a VPC                                |
| `aws_iam_role_policy.lambda_ecr`        | Pull the image, scoped to the one repository                            |
| `aws_iam_role_policy.lambda_deny`       | Explicit deny on every data-bearing service                             |
| `aws_cloudwatch_log_group.lambda`       | Function logs, retention per environment                                |
| `aws_lambda_function.this`              | The function itself, image packaged, in the isolated subnets            |
| `aws_lambda_function_event_invoke_config.this` | Retries disabled                                                 |
| `aws_iam_policy.invoke`                 | `lambda:InvokeFunction`, attached to the backend task role              |
| `aws_cloudwatch_log_metric_filter.rejected_traffic` | Counts REJECT lines in the subnet flow logs                 |

## 🔒 The deny policy

The allow policies above grant only logs, ENIs and an image pull. The deny policy exists because a future change to a shared or inherited policy could widen that quietly: an explicit `Deny` cannot be overridden by any `Allow`.

Its KMS statement scopes `Resource` to `arn:aws:kms:*:*:*` on purpose. A bare `NotAction = ["kms:Decrypt"]` denies every non-Decrypt action on every resource, including `logs:PutLogEvents` from the function's own log forwarding, which silently swallows stdout and stderr.

## ⏱️ Timeout

`var.timeout` must stay above the 30 second script budget enforced inside `handler.py`. Below it, a slow script is killed by Lambda and the operator sees a generic timeout instead of the handler's account of what failed.

## 🚀 Image lifecycle

`image_uri` is set to `:latest` at creation and then held in `ignore_changes`. Deployments go through `aws lambda update-function-code` in `.github/workflows/deploy-calibration-sandbox.yml`, so Terraform never fights CI over which image is current.
