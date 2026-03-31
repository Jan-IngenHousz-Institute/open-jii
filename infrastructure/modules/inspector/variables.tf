variable "resource_types" {
  description = "List of resource types to enable for Inspector2 (e.g., ECR, EC2, Lambda, LAMBDA_CODE)"
  type        = list(string)
}
