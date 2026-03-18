# Location Service Module

Creates an AWS Location Service Place Index for geocoding and place search, along with an IAM policy for access.

## What it does

- Creates a Place Index with configurable data source (Esri, Here, or Grab)
- Creates an IAM policy scoped to the Place Index for search/geocoding operations
- Policy can be attached to any role that needs location search access (e.g., ECS task role)

## Usage

```hcl
module "location_service" {
  source = "../../modules/location-service"

  place_index_name = "my-app-places-index"
  data_source      = "Esri"
  intended_use     = "SingleUse"
  iam_policy_name  = "MyApp-LocationServicePolicy"

  tags = {
    Environment = var.environment
    Project     = "my-project"
  }
}

# Attach the policy to an ECS task role
resource "aws_iam_role_policy_attachment" "ecs_location" {
  role       = module.ecs.ecs_task_role_arn
  policy_arn = module.location_service.iam_policy_arn
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| `place_index_name` | Name for the Place Index | `string` | — | yes |
| `data_source` | Data provider: `Esri`, `Here`, or `Grab` | `string` | `Esri` | no |
| `description` | Description for the Place Index | `string` | `"Place Index for search and geocoding operations"` | no |
| `intended_use` | `SingleUse` or `Storage` | `string` | `SingleUse` | no |
| `iam_policy_name` | Name for the IAM policy | `string` | `LocationServicePolicy` | no |
| `tags` | Tags to apply to resources | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| `place_index_name` | Name of the Place Index |
| `place_index_arn` | ARN of the Place Index |
| `iam_policy_arn` | ARN of the IAM policy for Location Service access |
| `iam_policy_name` | Name of the IAM policy |
