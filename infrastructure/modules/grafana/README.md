# Grafana Monitoring & DORA Metrics

This module sets up Amazon Managed Grafana (AMG) workspace with CloudWatch integration for monitoring application performance and tracking DORA (DevOps Research and Assessment) metrics.

## Architecture

```
GitHub Actions (Deployments)
    ↓
AWS CloudWatch Metrics
    ↓
Amazon Managed Grafana
    ↓
Dashboard Visualization
```

## What's Included

### Infrastructure Components

1. **Workspace Module** (`workspace/`) - AMG workspace and the daily round's Viewer service account
2. **Dashboard Module** (`dashboard/`) - Pre-configured monitoring dashboards
3. **Metrics Publisher** (`metrics-publisher/`) - Weekly Lambda that publishes registration and experiment counts to CloudWatch
4. **Cost Publisher** (`cost-publisher/`) - Daily Lambda that publishes what AWS bills, from Cost Explorer, to CloudWatch
5. **Grafana tokens** - Each OpenTofu run creates its own token; a scheduled workflow keeps the pull request plans' Viewer token current

### Monitored Metrics

#### Application Performance

- **ECS Backend**: CPU, memory, task count, response time
- **Lambda (NextJS)**: Invocations, duration, errors, throttles
- **CloudFront**: Requests, bandwidth, cache hit rate, 4xx/5xx errors
- **ALB**: Request count, response time, healthy/unhealthy targets
- **Database**: CPU, connections, IOPS, replication lag

#### DORA Metrics (DevOps Performance)

- **Deployment Frequency**: Deploy attempts per week and per service
- **Lead Time**: Time from commit to production deployment
- **Failed Deploy Rate**: Share of deploy runs that failed. DORA's change failure rate counts
  deploys that broke production, which these metrics cannot see.
- **Deployment Success Count**: Successful deploys per week and per service

### Alert Rules

Automated alerts notify your team when issues are detected:

#### Backend API Alerts

- **High Backend Error Rate**: Fires when 5XX error rate exceeds 5% for 5 minutes
- **Backend High CPU Usage**: Fires when ECS CPU usage exceeds 80% for 5 minutes
- **Backend Service Unhealthy**: Fires when unhealthy targets detected for 2 minutes

#### CloudFront Alerts

- **High CloudFront Error Rate**: Fires when 4XX + 5XX error rate exceeds 5% for 5 minutes

#### Lambda Alerts

- **Lambda High Error Rate**: Fires when Lambda errors exceed 5 in 5 minutes
- **Lambda Throttling**: Fires when Lambda throttling detected for 5 minutes

**Note**: Lambda alerts use CloudWatch `FILL(m1, 0)` to handle missing data (sparse metrics).

#### Database Alerts

- **Database High CPU**: Fires when RDS CPU usage exceeds 80% for 5 minutes
- **Database High Connections**: Fires when connection count exceeds 80 for 5 minutes

#### Notification Configuration

Alerts are routed to Slack via webhook with severity-based policies:

| Severity | Repeat Interval  | Examples                             |
| -------- | ---------------- | ------------------------------------ |
| Critical | Every 30 minutes | Unhealthy targets, Lambda throttling |
| Warning  | Every 12 hours   | High CPU, error rates                |
| DORA     | Every 24 hours   | DORA metric alerts                   |

**Alert States**:

- **Normal**: All conditions OK
- **Pending**: Condition met, waiting for `for` duration
- **Firing**: Alert active, notification sent
- **NoData**: No data available (alert stays OK)

### Services Tracked

- `backend` - NestJS API (ECS)
- `web` - Next.js frontend (Lambda/CloudFront)
- `docs` - Documentation site (S3/CloudFront)
- `database` - Migration deployments
- `databricks` - Lakehouse pipelines and jobs
- `macro-sandbox-python`, `macro-sandbox-javascript`, `macro-sandbox-r` - Macro sandboxes
- `calibration-sandbox` - Calibration sandbox

## Metrics Publisher

A Lambda that runs every Monday at 06:00 UTC, queries Aurora, and publishes `TotalUsers`, `WeeklyNewUsers` and `WeeklyNewExperiments` to CloudWatch under the `OpenJII/UserRegistrations` namespace. The weekly heartbeat report shows them as Researchers, New researchers and Experiments created. Its database user may read only the columns its counts filter on, never names, emails or keys, so a new count needs a migration granting `SELECT` on the columns it reads.

The Lambda is deployed from a committed `lambda/function.zip` that contains `index.js` and `node_modules`. The zip is committed to git so CI never needs to install dependencies.

### Rebuilding the zip

Run this whenever you change `index.js` or update `package.json`:

```bash
cd metrics-publisher/lambda
npm run build
git add function.zip
git commit -m "build: rebuild metrics-publisher function.zip"
```

## Cost Publisher

A Lambda that runs four times a day, reads Cost Explorer, and publishes yesterday's, the latest complete week's and the month's spend under `OpenJII/Cost`. The Cost dashboard and the weekly report's Cost section read it beside Databricks' own charges, which the heartbeat export prices from Databricks' billing tables. Which category each AWS service counts under is `docs/monitoring/cost-services.json`. See [`cost-publisher/README.md`](cost-publisher/README.md) for what it publishes and why each figure is stamped when its window closed.

## Setup Instructions

### Prerequisites

1. AWS account with appropriate permissions
2. GitHub repository with Actions enabled
3. Existing infrastructure (ECS, Lambda, CloudFront, ALB)

### Deployment (Two-Step Process)

**Important**: Apply in two steps to avoid provider dependency issues.

#### Step 1: Create AMG Workspace

```bash
cd infrastructure/env/dev

# Apply only the workspace module
tofu apply -target=module.managed_grafana_workspace

# Note the workspace URL from outputs
tofu output
```

**Why?** The workspace must exist before Grafana provider can configure dashboards.

#### Step 2: Create Dashboards

After workspace is created and accessible:

```bash
# Apply the dashboard module
tofu apply -target=module.grafana_dashboard

# Or apply everything
tofu apply
```

### How OpenTofu signs in to Grafana

Each OpenTofu plan and apply in the deploys, and the dev plan on a pull request, creates a token
for the workspace's `Admin_SA` service account after it signs in to AWS, and deletes it when the
run ends. A plan's token lives one hour and an apply's two, so a token a cancelled run leaves
behind stops working on its own. GitHub stores no token for these runs, only the two ids:

1. Get the workspace and service account IDs:

   ```bash
   aws grafana list-workspaces --region eu-central-1

   aws grafana list-workspace-service-accounts \
     --workspace-id YOUR_WORKSPACE_ID \
     --region eu-central-1
   ```

2. Add them to the environment (Settings → Environments → dev or prod) as
   `GRAFANA_WORKSPACE_ID_<ENV>` and `GRAFANA_SERVICE_ACCOUNT_ID_<ENV>`, for example
   `GRAFANA_WORKSPACE_ID_DEV`.

### The daily round's account

The workspace module creates `daily-round`, a Viewer service account the daily round reads Grafana
with. OpenTofu holds the account and never a token: each developer mints their own with the AWS CLI
and pipes it into `pnpm grafana:auth <env>`, which stores it in `tooling/devkit/.env`.
`tooling/devkit/README.md` has the commands. The `Admin_SA` account behind the deploys' per-run tokens
is separate and lives outside OpenTofu.

### The plan account

The module also creates `tofu-plan`, a Viewer service account for the read-only OpenTofu plans that
pull requests run through the `prod-plan` GitHub environment. The Rotate Grafana Token workflow
finds it by name, mints a 30-day token on the 1st and 15th, stores it as `GRAFANA_SERVICE_TOKEN` in
`prod-plan`, and revokes the account's older tokens.

### Access Grafana Dashboard

1. Get workspace URL:

   ```bash
   tofu output -json | jq -r '.managed_grafana_workspace.value.amg_url'
   ```

2. Sign in using AWS SSO (configured in your AWS account)

3. Navigate to Dashboards → Browse → "Open-JII Monitoring Dashboard"

### Configure Alerts

Alert notifications require a Slack webhook:

1. **Create Slack Webhook**:

   - Go to your Slack workspace → Apps → Incoming Webhooks
   - Create new webhook for your alerts channel
   - Copy the webhook URL

2. **Add to Terraform Variables**:

   ```hcl
   # infrastructure/env/dev/terraform.tfvars
   slack_webhook_url = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
   ```

3. **Apply Configuration**:

   ```bash
   cd infrastructure/env/dev
   tofu apply -target=module.grafana_dashboard
   ```

4. **Test Alerts**:
   - Go to Grafana → Alerting → Alert rules
   - Select any alert → "Evaluate" button
   - Check Slack for test notification

**Alert Testing in Dev**:

- Temporarily lower thresholds (e.g., CPU > 40% instead of 80%)
- Use short evaluation periods (1m instead of 5m)
- Revert to production values after testing

## DORA Metrics Collection

### How It Works

1. **GitHub Actions Workflows** capture deployment events
2. Workflows publish metrics to **CloudWatch** during deployments
3. **Grafana** queries CloudWatch and visualizes metrics
4. Metrics are tracked per service and environment

### Metrics Details

| Metric              | Type         | Dimensions           | Description                             |
| ------------------- | ------------ | -------------------- | --------------------------------------- |
| DeploymentFrequency | Count        | Service, Environment | Number of deployments                   |
| LeadTime            | Milliseconds | Service, Environment | Commit timestamp to deployment complete |
| DeploymentSuccess   | Count        | Service, Environment | Successful deployments                  |
| DeploymentFailed    | Count        | Service, Environment | Failed deployments                      |

**Namespace**: `DORA/Metrics`

### Collected By

- `.github/workflows/deploy-backend.yml` - Backend deployments
- `.github/workflows/deploy-nextjs-opennext.yml` - Web deployments
- `.github/workflows/deploy-docs.yml` - Docs deployments
- `.github/workflows/database-migrations.yml` - Database migrations

Each workflow uses `.github/actions/publish-dora-metric/action.yml` composite action.

### Dashboard Panels

**DORA Metrics Section** (6 panels):

1. **Deployment Frequency (24h)** - Total deployments across all services
2. **Average Lead Time (24h)** - Mean time from commit to production
3. **Change Failure Rate (24h)** - Percentage of failed deployments
4. **Deployment Success Rate (24h)** - Percentage of successful deployments
5. **Deployment Frequency by Service (7d)** - Line chart per service
6. **Lead Time Trend by Service (7d)** - Lead time trends

## Maintenance

### Token Rotation

Deploys need no rotation, since each run creates its own token. Only the `tofu-plan` Viewer token
in `prod-plan` rotates:

- Workflow: `.github/workflows/rotate-grafana-token.yml`
- Schedule: 1st and 15th of each month
- Token validity: 30 days

### Updating Dashboards

The two heartbeat reports come from `dashboard/heartbeat.tf` and the metrics catalogue. The
Platform, Data pipeline and Delivery dashboards come from `dashboard/flows.tf`. Platform and Data
pipeline have a section per question (traffic or volume, errors, latency, saturation or
freshness): the question's chart, what to check first when it looks wrong, then each hop's panels
from `dashboard/flows/*.json.tftpl` in the order a request or a measurement travels, in the hop's
colour. Throughput and storage is laid out in `dashboard/throughput.tf`, and Cost in
`dashboard/cost.tf`, which also builds the weekly report's Cost section.

1. Edit the section's panels in `dashboard/flows/<dashboard>.json.tftpl`, or the generated
   panels in `dashboard/flows.tf`
2. Apply changes:
   ```bash
   cd infrastructure/env/dev
   tofu apply -target=module.grafana_dashboard
   ```

### Adding New Metrics

1. **Publish metric** in deployment workflow:

   ```yaml
   - uses: ./.github/actions/publish-dora-metric
     with:
       metric-name: YourMetricName
       value: "1"
       unit: Count
       service: your-service
       environment: dev
   ```

2. The Delivery dashboard reads every service under `DORA/Metrics` with a search on the
   `Service` and `Environment` dimensions, so a new service appears without a panel change.

## Troubleshooting

### Dashboard Not Showing Data

**Check CloudWatch metrics exist:**

```bash
aws cloudwatch list-metrics \
  --namespace "DORA/Metrics" \
  --region eu-central-1
```

**Check metric dimensions:**

- Service: backend, web, docs, database
- Environment: dev, staging, prod

**Verify Grafana datasource:**

- Dashboard → Settings → Data sources
- CloudWatch should be configured with correct region

### Token Expired

If a deploy's plan or apply fails to sign in to Grafana, check that the "Create a Grafana token for
this run" step passed and that the environment's `GRAFANA_WORKSPACE_ID_<ENV>` and
`GRAFANA_SERVICE_ACCOUNT_ID_<ENV>` still match the workspace. If a pull request's prod plan fails
to sign in, run the token rotation manually:

```bash
gh workflow run rotate-grafana-token.yml
```

### Deployment Metrics Not Appearing

**Check workflow ran successfully:**

- GitHub Actions → Select workflow → Check "Publish DORA Metrics" steps

**Verify IAM permissions:**

- GitHub OIDC role needs `cloudwatch:PutMetricData`

**Check metric publication:**

```bash
# View recent metrics
aws cloudwatch get-metric-statistics \
  --namespace "DORA/Metrics" \
  --metric-name DeploymentFrequency \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  --region eu-central-1
```

### Terraform Apply Issues

**Provider error:**

```text
Error: Failed to configure Grafana provider
```

**Solution**: Apply workspace first, then dashboards (see Deployment steps above).

**State lock:**

```text
Error: Error acquiring the state lock
```

**Solution**:

```bash
tofu force-unlock LOCK_ID
```

## Cost Estimation

### Monthly Costs (Dev Environment)

| Service                | Cost           | Notes                 |
| ---------------------- | -------------- | --------------------- |
| Amazon Managed Grafana | ~$9/month      | Free tier: 744 hours  |
| CloudWatch Metrics     | ~$0.50         | Custom metrics (DORA) |
| CloudWatch Logs        | ~$1            | Dashboard queries     |
| Cost Explorer API      | ~$3.60         | Twelve requests a day |
| **Total**              | **~$14/month** | Varies with usage     |

**Free Tier Included:**

- CloudWatch: 10 custom metrics, 1M API requests
- Lambda: 1M requests, 400K GB-seconds

## References

- [Amazon Managed Grafana Docs](https://docs.aws.amazon.com/grafana/)
- [DORA Metrics Guide](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance)
- [CloudWatch Metrics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/working_with_metrics.html)
- [Amazon Managed Grafana service accounts](https://docs.aws.amazon.com/grafana/latest/userguide/service-accounts.html)

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review GitHub Actions logs
3. Check CloudWatch metrics console
4. Verify Grafana datasource configuration
