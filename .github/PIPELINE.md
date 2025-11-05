# CI/CD Pipeline Architecture

## Pipeline Flow

```mermaid
sequenceDiagram
    participant 👤 as User
    participant 🚀 as GitHub Actions
    participant 🎯 as deploy.yml<br/>(Main Orchestrator)
    participant 🔍 as detect-changes<br/>(Change Detection)
    participant 🏗️ as tofu.yml<br/>(Infrastructure)
    participant 🗄️ as database-migrations.yml<br/>(Database)
    participant ⚙️ as deploy-backend.yml<br/>(Backend Service)
    participant 🌐 as deploy-nextjs-opennext.yml<br/>(Frontend App)
    participant ☁️ as AWS Cloud

    Note over 👤, 🚀: WORKFLOW INITIATION
    👤->>🚀: Push to main branch / Manual trigger
    🚀->>🎯: Trigger Deployment Workflow
    🎯->>🎯: Set concurrency group: deploy-{environment}

    Note over 🎯, 🔍: CHANGE DETECTION PHASE
    🎯->>🔍: ▶️ Start change detection
    🔍->>🔍: Checkout repository (full history)
    🔍->>🔍: Setup Node.js 22 & pnpm
    🔍->>🔍: Run Turbo change detection
    🔍-->>🎯: Return: affected_apps JSON array

    Note over 🎯, ☁️: INFRASTRUCTURE DEPLOYMENT
    alt deploy_infrastructure = true
        🎯->>🏗️: ▶️ Call tofu.yml (apply=true)
        🏗️->>☁️: OIDC authentication & AWS setup
        🏗️->>☁️: Format check & validation
        🏗️->>☁️: Generate infrastructure plan
        🏗️->>☁️: Apply infrastructure changes
        🏗️-->>🎯: ✅ Infrastructure ready
    else infrastructure disabled
        Note over 🎯: ⏭️ Skip infrastructure deployment
    end

    Note over 🎯, ☁️: SERVICE DEPLOYMENTS (Sequential for API Compatibility)

    alt 'database' ∈ affected_apps
        🎯->>🗄️: ▶️ Call database-migrations.yml
        🗄️->>☁️: OIDC authentication & AWS setup
        🗄️->>☁️: Get SSM configuration
        🗄️->>☁️: Build & push migration image (ECR)
        🗄️->>☁️: Run migration task (ECS)
        🗄️-->>🎯: ✅ Migrations complete
    else no database changes
        Note over 🗄️: ⏭️ Skip database migrations
    end

    alt 'backend' ∈ affected_apps
        🎯->>⚙️: ▶️ Call deploy-backend.yml<br/>(waits for DB migrations)
        ⚙️->>☁️: OIDC authentication & AWS setup
        ⚙️->>☁️: Build & push app image (ECR)
        ⚙️->>☁️: Update ECS task definition
        ⚙️->>☁️: Deploy to ECS service
        ⚙️-->>🎯: ✅ Backend deployed
    else no backend changes
        Note over ⚙️: ⏭️ Skip backend deployment
    end

    alt 'web' ∈ affected_apps
        🎯->>🌐: ▶️ Call deploy-nextjs-opennext.yml<br/>(waits for backend)
        🌐->>🌐: Build Next.js app with OpenNext
        🌐->>☁️: OIDC authentication & AWS setup
        🌐->>☁️: Get SSM configuration
        🌐->>☁️: Upload static assets (S3)
        🌐->>☁️: Deploy Lambda functions
        🌐->>☁️: Invalidate CloudFront cache
        🌐-->>🎯: ✅ Frontend deployed
    else no frontend changes
        Note over 🌐: ⏭️ Skip frontend deployment
    end

    Note over 🎯, : WORKFLOW COMPLETION
    🎯-->>👤: ✅ Deployment workflow complete

    Note left of 🎯: Execution Model:<br/>• Sequential: Infrastructure → DB → Backend → Frontend<br/>• Fresh Runners: Each workflow_call gets clean environment<br/>• OIDC: All AWS access uses temporary credentials<br/>• Conditional: Based on change detection<br/>• Notifications: Native GitHub-Slack integration

    Note right of ☁️: AWS Services Used:<br/>• SSM Parameter Store (config)<br/>• ECR (container images)<br/>• ECS (container orchestration)<br/>• S3 (static assets & cache)<br/>• Lambda (serverless functions)<br/>• CloudFront (CDN)
```

## Workflow Architecture

### Core Workflows

- **deploy.yml** - Main orchestrator, handles change detection and sequential deployments
- **tofu.yml** - Infrastructure management with OpenTofu (plan/apply modes)
- **database-migrations.yml** - Containerized database migrations on ECS
- **deploy-backend.yml** - Backend service deployment to ECS
- **deploy-nextjs-opennext.yml** - Frontend deployment to Lambda/S3/CloudFront

### Change Detection

Uses Turbo to detect affected packages since last successful deployment:

- Returns JSON array of changed applications
- Enables conditional deployment of only affected services
- Prevents unnecessary deployments and reduces pipeline time

### Infrastructure Configuration

**SSM Parameter Store Structure:**

```text
/opennext/{environment}/
├── assets_bucket_name
├── cache_bucket_name
├── server_function_name
├── image_function_name
├── revalidation_function_name
├── warmer_function_name
├── dynamodb_table_name
└── cloudfront_distribution_id

/migration/{environment}/
├── migration_runner_ecs_cluster_name
├── migration_runner_task_definition_family
├── migration_runner_ecr_repository_name
├── migration_runner_container_name
├── migration_runner_subnets
└── migration_runner_security_group_id
```

### Authentication

**OIDC Roles:**

- `AWS_INFRASTRUCTURE_ROLE_ARN` - Infrastructure deployment (broader permissions)
- `AWS_ROLE_ARN` - Application deployment (scoped permissions)

### Deployment Order

1. **Infrastructure** - OpenTofu applies infrastructure changes
2. **Database** - Migrations run before application deployments
3. **Backend** - API deployed after database is ready
4. **Frontend** - Web app deployed after backend is ready

This sequence prevents API compatibility issues during deployments.

### Notifications

Pipeline uses GitHub's native Slack integration for notifications:

- **Workflow Status** - Success/failure notifications sent automatically
- **No Custom Webhooks** - Leverages existing GitHub-Slack app connection
- **Consistent Experience** - Same notification system as PR/issue updates
- **Configuration** - Managed through Slack's `/github subscribe` commands
