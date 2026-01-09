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

1. **Workspace Module** (`workspace/`) - AMG workspace with service account
2. **Dashboard Module** (`dashboard/`) - Pre-configured monitoring dashboards
3. **Token Rotation** (`TOKEN_ROTATION.md`) - Automated token management

### Monitored Metrics

#### Application Performance
- **ECS Backend**: CPU, memory, task count, response time
- **Lambda (NextJS)**: Invocations, duration, errors, throttles
- **CloudFront**: Requests, bandwidth, cache hit rate, 4xx/5xx errors
- **ALB**: Request count, response time, healthy/unhealthy targets
- **Database**: CPU, connections, IOPS, replication lag

#### DORA Metrics (DevOps Performance)
- **Deployment Frequency**: How often deployments succeed (24h/7d)
- **Lead Time**: Time from commit to production deployment
- **Change Failure Rate**: Percentage of deployments that fail
- **Deployment Success Rate**: Percentage of successful deployments

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

| Severity | Repeat Interval | Examples |
|----------|----------------|----------|
| Critical | Every 30 minutes | Unhealthy targets, Lambda throttling |
| Warning | Every 12 hours | High CPU, error rates |
| DORA | Every 24 hours | DORA metric alerts |

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

### Initial Token Setup

#### Option A: Use GitHub Actions Workflow (Recommended)

1. Get workspace and service account IDs:
   ```bash
   # Workspace ID
   aws grafana list-workspaces --region eu-central-1
   
   # Service account ID
   aws grafana list-workspace-service-accounts \
     --workspace-id YOUR_WORKSPACE_ID \
     --region eu-central-1
   ```

2. Add to GitHub Secrets (Settings → Secrets → Environments → dev):
   - `GRAFANA_WORKSPACE_ID_DEV` = your workspace ID
   - `GRAFANA_SERVICE_ACCOUNT_ID_DEV` = your service account ID

3. Run rotation workflow manually:
   ```bash
   gh workflow run rotate-grafana-token.yml
   ```

   This creates the token and stores it in `GRAFANA_SERVICE_TOKEN` secret.

#### Option B: Manual Token Creation

```bash
aws grafana create-workspace-service-account-token \
  --name "initial-token-$(date +%Y%m%d)" \
  --workspace-id YOUR_WORKSPACE_ID \
  --service-account-id YOUR_SERVICE_ACCOUNT_ID \
  --seconds-to-live 2592000 \
  --region eu-central-1
```

Add the token to GitHub Secrets as `GRAFANA_SERVICE_TOKEN` in the dev environment.

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

| Metric | Type | Dimensions | Description |
|--------|------|-----------|-------------|
| DeploymentFrequency | Count | Service, Environment | Number of deployments |
| LeadTime | Milliseconds | Service, Environment | Commit timestamp to deployment complete |
| DeploymentSuccess | Count | Service, Environment | Successful deployments |
| DeploymentFailed | Count | Service, Environment | Failed deployments |

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

Tokens automatically rotate every ~15 days via GitHub Actions:
- Workflow: `.github/workflows/rotate-grafana-token.yml`
- Schedule: 1st and 15th of each month
- Token validity: 30 days
- See [TOKEN_ROTATION.md](TOKEN_ROTATION.md) for details

### Updating Dashboards

1. Edit `dashboard/dashboard.json.tftpl`
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

2. **Add panel** to `dashboard/dashboard.json.tftpl`:
   - Query CloudWatch namespace `DORA/Metrics`
   - Use dimensions: Service, Environment
   - Set `matchExact: false` for wildcard queries

3. Apply dashboard changes

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

If you see authentication errors:

1. Run token rotation manually:
   ```bash
   gh workflow run rotate-grafana-token.yml
   ```

2. Or create new token manually (see Initial Token Setup)

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
```
Error: Failed to configure Grafana provider
```

**Solution**: Apply workspace first, then dashboards (see Deployment steps above).

**State lock:**
```
Error: Error acquiring the state lock
```

**Solution**: 
```bash
tofu force-unlock LOCK_ID
```

## Cost Estimation

### Monthly Costs (Dev Environment)

| Service | Cost | Notes |
|---------|------|-------|
| Amazon Managed Grafana | ~$9/month | Free tier: 744 hours |
| CloudWatch Metrics | ~$0.50 | Custom metrics (DORA) |
| CloudWatch Logs | ~$1 | Dashboard queries |
| **Total** | **~$10.50/month** | Varies with usage |

**Free Tier Included:**
- CloudWatch: 10 custom metrics, 1M API requests
- Lambda: 1M requests, 400K GB-seconds

## References

- [Amazon Managed Grafana Docs](https://docs.aws.amazon.com/grafana/)
- [DORA Metrics Guide](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance)
- [CloudWatch Metrics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/working_with_metrics.html)
- [Token Rotation Setup](TOKEN_ROTATION.md)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review GitHub Actions logs
3. Check CloudWatch metrics console
4. Verify Grafana datasource configuration
