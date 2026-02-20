# ============================================================
# Outputs — for backend integration
# ============================================================
# The backend ECS task role needs:
#   lambda:InvokeFunction on these function ARNs
#
# Backend invocation pattern (TypeScript):
#   const lambda = new LambdaClient({});
#   const result = await lambda.send(new InvokeCommand({
#     FunctionName: "macro-runner-python-dev",
#     Payload: JSON.stringify({ script, items, timeout }),
#   }));
# ============================================================

output "function_arns" {
  description = "Lambda function ARNs for macro execution (add lambda:InvokeFunction to backend task role)"
  value = {
    python     = aws_lambda_function.this["python"].arn
    javascript = aws_lambda_function.this["js"].arn
    r          = aws_lambda_function.this["r"].arn
  }
}

output "function_names" {
  description = "Lambda function names for macro execution"
  value = {
    python     = aws_lambda_function.this["python"].function_name
    javascript = aws_lambda_function.this["js"].function_name
    r          = aws_lambda_function.this["r"].function_name
  }
}

output "lambda_sg_id" {
  description = "Security group ID for macro-runner Lambda functions (pass-through from VPC module)"
  value       = var.lambda_sg_id
}

output "lambda_role_arn" {
  description = "IAM role ARN used by macro-runner Lambda functions"
  value       = aws_iam_role.lambda.arn
}

output "invoke_policy_arn" {
  description = "IAM policy ARN granting lambda:InvokeFunction on all macro-runner functions — attach to backend task role"
  value       = aws_iam_policy.invoke.arn
}
