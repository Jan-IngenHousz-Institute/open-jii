# ECS-based Database Migration Module

This module sets up the infrastructure needed to run database migrations securely from GitHub Actions to an Aurora Serverless v2 database in a private VPC. It leverages ECS Fargate to run migrations within your VPC, providing secure access to your database without exposing it to public networks.

## Features

- Creates an ECR repository for storing migration container images
- Sets up ECS task definition with proper IAM roles
- Creates a security group with access to the Aurora database
- Configures CloudWatch logging for migration tasks
- Integrates with Secrets Manager for secure database credentials

## Usage

This module is designed to be used with the `iam-oidc` and `iam-github-actions` modules to create a complete CI/CD solution for database migrations.

```hcl
# Set up the GitHub OIDC provider and role
module "github_oidc" {
  source      = "../iam-oidc"
  aws_region  = var.region
  role_name   = "github-actions-role"
  repository  = "your-org/your-repo"
  branch      = "main"
}

# Set up the migration infrastructure
module "db_migration" {
  source             = "../migration-ecs"
  aws_region         = var.region
  task_name          = "drizzle-migrations"
  ecr_repository_name = "drizzle-migrations"

  # VPC and networking
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnets
  db_security_group_id = module.aurora_db.security_group_id
  db_port            = 5432

  # Database credentials in Secrets Manager
  db_secret_arn      = module.aurora_db.secret_arn

  # Environment configuration
  environment        = var.environment
  environment_variables = [
    {
      name  = "MIGRATION_DIR"
      value = "/app/migrations"
    }
  ]

  tags = {
    Environment = var.environment
    Project     = "database-migrations"
  }
}

# Add the required permissions to the GitHub Actions role
module "github_actions_migration_permissions" {
  source                   = "../iam-github-actions"
  policy_name              = "drizzle-migration-policy"
  github_actions_role_name = module.github_oidc.role_name
  ecr_repository_arn       = module.db_migration.ecr_repository_arn
  ecs_task_definition_arn  = module.db_migration.task_definition_arn
  task_execution_role_arn  = module.db_migration.task_execution_role_arn
  task_role_arn            = module.db_migration.task_role_arn
  cloudwatch_log_group_arn = module.db_migration.cloudwatch_log_group_arn

  tags = {
    Environment = var.environment
    Project     = "database-migrations"
  }
}
```

## Docker Image for Migrations

You'll need to create a Docker image for running Drizzle ORM migrations. Here's a sample Dockerfile:

```dockerfile
FROM node:18-slim

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Set the command to run migrations
CMD ["node", "scripts/run-migrations.js"]
```

## GitHub Actions Workflow

Here's a sample GitHub Actions workflow that builds the migration Docker image, pushes it to ECR, and runs the migrations:

```yaml
name: Database Migrations

on:
  push:
    branches: [main]
    paths:
      - "packages/database/**"
  workflow_dispatch:

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: us-west-2

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push image to Amazon ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: drizzle-migrations
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG -t $ECR_REGISTRY/$ECR_REPOSITORY:latest ./packages/database
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Run migrations in ECS
        run: |
          aws ecs run-task \
            --cluster default \
            --task-definition drizzle-migrations \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[subnet-1234abcd],securityGroups=[sg-1234abcd],assignPublicIp=DISABLED}" \
            --wait
```

## Inputs

| Name                  | Description                                                                 | Type                                              | Default           | Required |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------- | ----------------- | :------: |
| task_name             | Name for the ECS task that will run migrations                              | `string`                                          | `"db-migrations"` |    no    |
| ecr_repository_name   | Name for the ECR repository to store migration container images             | `string`                                          | `"db-migrations"` |    no    |
| aws_region            | The AWS region where resources will be created                              | `string`                                          | n/a               |   yes    |
| vpc_id                | ID of the VPC where resources will be created                               | `string`                                          | n/a               |   yes    |
| private_subnet_ids    | List of private subnet IDs where the ECS task will run                      | `list(string)`                                    | n/a               |   yes    |
| db_security_group_id  | ID of the security group attached to the Aurora database                    | `string`                                          | `null`            |    no    |
| db_port               | Port number the Aurora database is listening on                             | `number`                                          | `5432`            |    no    |
| db_secret_arn         | ARN of the Secrets Manager secret containing the database connection string | `string`                                          | n/a               |   yes    |
| task_cpu              | CPU units for the ECS task (1024 = 1 vCPU)                                  | `number`                                          | `256`             |    no    |
| task_memory           | Memory (in MiB) for the ECS task                                            | `number`                                          | `512`             |    no    |
| ephemeral_storage     | Ephemeral storage (in GiB) for the ECS task                                 | `number`                                          | `21`              |    no    |
| log_retention_days    | Number of days to retain migration logs in CloudWatch                       | `number`                                          | `30`              |    no    |
| environment           | Environment name (e.g., dev, staging, prod)                                 | `string`                                          | n/a               |   yes    |
| environment_variables | Additional environment variables for the migration container                | `list(object({ name = string, value = string }))` | `[]`              |    no    |
| tags                  | Tags to apply to all resources                                              | `map(string)`                                     | `{}`              |    no    |

## Outputs

| Name                     | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| ecr_repository_url       | URL of the ECR repository for migration container images |
| ecr_repository_arn       | ARN of the ECR repository for migration container images |
| task_definition_arn      | ARN of the ECS task definition for migrations            |
| task_execution_role_arn  | ARN of the execution role for the ECS task               |
| task_role_arn            | ARN of the task role for the ECS task                    |
| cloudwatch_log_group_arn | ARN of the CloudWatch log group for the ECS task         |
| security_group_id        | ID of the security group created for the ECS task        |
