module "terraform_state_s3" {
  source      = "../../modules/s3"
  bucket_name = "open-jii-terraform-state-${var.environment}"
}

module "terraform_state_lock" {
  source     = "../../modules/dynamodb"
  table_name = "terraform-state-lock"
}

module "iam_oidc" {
  source     = "../../modules/iam-oidc"
  role_name  = "GithubActionsDeployAccess"
  repository = "Jan-IngenHousz-Institute/open-jii"
  branch     = "main"
  aws_region = var.aws_region

  environment        = var.environment
  github_environment = var.environment
}

module "cloudwatch" {
  source                 = "../../modules/cloudwatch"
  aws_region             = var.aws_region
  log_retention_days     = 60
  cloudwatch_role_name   = "open_jii_${var.environment}_iot_logging_role"
  cloudwatch_policy_name = "open_jii_${var.environment}_iot_logging_policy"
}

# Access logs bucket
module "logs_bucket" {
  source      = "../../modules/s3"
  bucket_name = "open-jii-${var.environment}-access-logs"

  # Configure for logging purposes
  enable_versioning = false

  tags = {
    Environment = "prod"
    Project     = "open-jii"
    ManagedBy   = "Terraform"
    Component   = "logging"
  }
}

module "docusaurus_s3" {
  source                      = "../../modules/s3"
  enable_versioning           = false
  bucket_name                 = "open-jii-docs-public-${var.environment}"
  cloudfront_distribution_arn = module.docs_cloudfront.cloudfront_distribution_arn
}

module "timestream" {
  source        = "../../modules/timestream"
  database_name = "open_jii_${var.environment}_data_ingest_db"
  table_name    = "measurements"
}

module "kinesis" {
  source      = "../../modules/kinesis"
  stream_name = "open-jii-${var.environment}-data-ingest-stream"

  workspace_kinesis_credential_id = var.kinesis_credential_id
}

module "iot_core" {
  source      = "../../modules/iot-core"
  environment = var.environment

  timestream_table           = "measurements"
  timestream_database        = "open_jii_${var.environment}_data_ingest_db"
  iot_timestream_role_name   = "open_jii_${var.environment}_iot_timestream_role"
  iot_timestream_policy_name = "open_jii_${var.environment}_iot_timestream_policy"

  iot_kinesis_role_name   = "open_jii_${var.environment}_iot_kinesis_role"
  iot_kinesis_policy_name = "open_jii_${var.environment}_iot_kinesis_policy"
  kinesis_stream_name     = module.kinesis.kinesis_stream_name
  kinesis_stream_arn      = module.kinesis.kinesis_stream_arn

  cloudwatch_role_arn = module.cloudwatch.iot_cloudwatch_role_arn
}

module "cognito" {
  source             = "../../modules/cognito"
  region             = var.aws_region
  identity_pool_name = "open-jii-${var.environment}-iot-identity-pool"
}

module "vpc" {
  source      = "../../modules/vpc"
  environment = var.environment
}

module "vpc_endpoints" {
  source = "../../modules/vpc-endpoints"

  aws_region  = var.aws_region
  environment = var.environment

  vpc_id                  = module.vpc.vpc_id
  private_route_table_ids = module.vpc.private_rt_ids
  public_route_table_ids  = module.vpc.public_rt_ids
  private_subnet_ids      = module.vpc.private_subnets
  security_group_ids      = [module.vpc.default_sg_id]
}

module "databricks_workspace_s3_policy" {
  source      = "../../modules/databricks/workspace-s3-policy"
  bucket_name = "open-jii-databricks-root-bucket-${var.environment}"
}

module "databricks_workspace_s3" {
  source             = "../../modules/s3"
  bucket_name        = "open-jii-databricks-root-bucket-${var.environment}"
  enable_versioning  = false
  custom_policy_json = module.databricks_workspace_s3_policy.policy_json
}

module "databricks_workspace" {
  source = "../../modules/databricks/workspace"

  aws_region            = var.aws_region
  environment           = var.environment
  databricks_account_id = var.databricks_account_id

  bucket_name     = module.databricks_workspace_s3.bucket_id
  vpc_id          = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnets
  sg_id           = module.vpc.default_sg_id

  kinesis_role_arn  = module.kinesis.role_arn
  kinesis_role_name = module.kinesis.role_name

  principal_ids = [module.node_service_principal.service_principal_id]

  providers = {
    databricks.mws       = databricks.mws
    databricks.workspace = databricks.workspace
  }
}

module "node_service_principal" {
  source = "../../modules/databricks/service_principal"

  display_name  = "node-service-principal-${var.environment}"
  create_secret = true

  providers = {
    databricks.mws = databricks.mws
  }
}

# Create Slack notification destination
module "slack_notification_destination" {
  source = "../../modules/databricks/notification-destination"

  display_name      = "slack-notifications-${var.environment}"
  slack_webhook_url = var.slack_webhook_url

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.databricks_workspace]
}

# Create secret scope for Event Hooks
module "event_hooks_secret_scope" {
  source = "../../modules/databricks/secret_scope"

  scope_name = "event-hooks-${var.environment}"

  secrets = {
    "slack-webhook-url" = var.slack_webhook_url
    "databricks-host"   = module.databricks_workspace.workspace_url
  }

  # Grant access to service principal for Event Hooks
  acl_principals  = [module.node_service_principal.service_principal_application_id]
  acl_permissions = ["READ"]

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.databricks_workspace]
}

# Create storage credential for accessing centralized metastore
module "storage_credential" {
  source = "../../modules/databricks/workspace-storage-credential"

  credential_name = "open-jii-${var.environment}-metastore-access"
  role_name       = "open-jii-${var.environment}-uc-access"
  environment     = var.environment
  bucket_name     = var.centralized_metastore_bucket_name
  isolation_mode  = "ISOLATION_MODE_OPEN"

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.databricks_workspace]
}

# Create external location for this environment
module "external_location" {
  source = "../../modules/databricks/external-location"

  external_location_name  = "external-${var.environment}"
  bucket_name             = var.centralized_metastore_bucket_name
  external_location_path  = "external/${var.environment}"
  storage_credential_name = module.storage_credential.storage_credential_name
  environment             = var.environment
  comment                 = "External location for ${var.environment} environment data"
  isolation_mode          = "ISOLATION_MODE_ISOLATED"

  grants = {
    node_service_principal = {
      principal = module.node_service_principal.service_principal_application_id
      privileges = [
        "READ_FILES",
        "WRITE_FILES"
      ]
    }
  }

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.storage_credential]
}

module "experiment_secret_scope" {
  source = "../../modules/databricks/secret_scope"

  scope_name = "node-webhook-secret-scope-${var.environment}"
  secrets = {
    webhook_api_key_id = var.backend_webhook_api_key_id
    webhook_secret     = var.backend_webhook_secret
    webhook_base_url   = "https://${module.route53.api_domain}"
  }

  acl_principals  = [module.node_service_principal.service_principal_application_id]
  acl_permissions = ["READ"]

  providers = {
    databricks.workspace = databricks.workspace
  }
}

module "databricks_catalog" {
  source       = "../../modules/databricks/catalog"
  catalog_name = "open_jii_${var.environment}"

  external_bucket_id     = var.centralized_metastore_bucket_name
  external_location_path = "external/${var.environment}"
  isolation_mode         = "ISOLATED"

  grants = {
    node_service_principal = {
      principal = module.node_service_principal.service_principal_application_id
      privileges = [
        "BROWSE",
        "CREATE_FUNCTION",
        "CREATE_MATERIALIZED_VIEW",
        "CREATE_MODEL",
        "CREATE_MODEL_VERSION",
        "CREATE_SCHEMA",
        "CREATE_TABLE",
        "CREATE_VOLUME",
        "READ_VOLUME",
        "SELECT",
        "USE_CATALOG",
        "USE_SCHEMA"
      ]
    }
  }

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.node_service_principal]
}

module "centrum_pipeline" {
  source = "../../modules/databricks/pipeline"

  name         = "Centrum-DLT-Pipeline-PROD"
  schema_name  = "centrum"
  catalog_name = module.databricks_catalog.catalog_name

  notebook_paths = [
    "/Workspace/Shared/notebooks/pipelines/centrum_pipeline"
  ]

  configuration = {
    "BRONZE_TABLE"             = "raw_data"
    "SILVER_TABLE"             = "clean_data"
    "RAW_KINESIS_TABLE"        = "raw_kinesis_data"
    "KINESIS_STREAM_NAME"      = module.kinesis.kinesis_stream_name
    "SERVICE_CREDENTIAL_NAME"  = "unity-catalog-kinesis-role-${var.environment}"
    "CHECKPOINT_PATH"          = "/Volumes/${module.databricks_catalog.catalog_name}/centrum/checkpoints/kinesis"
    "ENVIRONMENT"              = upper(var.environment)
    "MONITORING_SLACK_CHANNEL" = var.slack_channel
  }

  continuous_mode  = false
  development_mode = true
  serverless       = true

  run_as = {
    service_principal_name = module.node_service_principal.service_principal_application_id
  }

  permissions = [
    {
      principal_application_id = module.node_service_principal.service_principal_application_id
      permission_level         = "CAN_RUN"
    }
  ]

  providers = {
    databricks.workspace = databricks.workspace
  }
}

module "pipeline_scheduler" {
  source = "../../modules/databricks/job"

  name        = "Pipeline-Scheduler-PROD"
  description = "Orchestrates central pipeline execution followed by all experiment pipelines every 15 minutes between 6am and 6pm"

  # Schedule: Every 15 minutes (0, 15, 30, 45) between 6am and 6pm (UTC)
  # Format: "seconds minutes hours day-of-month month day-of-week"
  schedule = "0 0,15,30,45 6-18 * * ?"

  max_concurrent_runs           = 1
  use_serverless                = true
  continuous                    = false
  serverless_performance_target = "STANDARD"

  run_as = {
    service_principal_name = module.node_service_principal.service_principal_application_id
  }

  # Configure task retries
  task_retry_config = {
    retries                   = 2
    min_retry_interval_millis = 60000
    retry_on_timeout          = true
  }

  tasks = [
    {
      key          = "trigger_centrum_pipeline"
      task_type    = "pipeline"
      compute_type = "serverless"
      pipeline_id  = module.centrum_pipeline.pipeline_id
    },
    {
      key           = "trigger_experiment_pipelines"
      task_type     = "notebook"
      compute_type  = "serverless"
      notebook_path = "/Workspace/Shared/notebooks/tasks/experiment_pipelines_orchestrator_task"

      parameters = {
        "catalog_name"            = module.databricks_catalog.catalog_name,
        "central_schema"          = "centrum",
        "experiment_status_table" = "experiment_status",
        "environment"             = upper(var.environment)
      }

      depends_on = "trigger_centrum_pipeline"
    },
  ]

  webhook_notifications = {
    on_start = [
      module.slack_notification_destination.notification_destination_id
    ]
    on_failure = [
      module.slack_notification_destination.notification_destination_id
    ]
  }

  permissions = [
    {
      principal_application_id = module.node_service_principal.service_principal_application_id
      permission_level         = "CAN_MANAGE_RUN"
    }
  ]

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.centrum_pipeline]
}

module "centrum_backup_job" {
  source = "../../modules/databricks/job"

  name        = "Centrum-Backup-Job-PROD"
  description = "Backs up raw_data from centrum schema every 8 hours to dedicated backup location"

  # Schedule: Every 8 hours at 00:00, 08:00, and 16:00 UTC
  # Format: "seconds minutes hours day-of-month month day-of-week"
  schedule = "0 0 0,8,16 * * ?"

  max_concurrent_runs           = 1
  use_serverless                = true
  continuous                    = false
  serverless_performance_target = "STANDARD"

  run_as = {
    service_principal_name = module.node_service_principal.service_principal_application_id
  }

  # Configure task retries
  task_retry_config = {
    retries                   = 2
    min_retry_interval_millis = 120000
    retry_on_timeout          = true
  }

  tasks = [
    {
      key           = "backup_centrum_raw_data"
      task_type     = "notebook"
      compute_type  = "serverless"
      notebook_path = "/Workspace/Shared/notebooks/tasks/centrum_backup_task"

      parameters = {
        "CATALOG_NAME"    = module.databricks_catalog.catalog_name
        "CENTRAL_SCHEMA"  = "centrum"
        "SOURCE_TABLE"    = "raw_data"
        "BACKUP_LOCATION" = "s3://${var.centralized_metastore_bucket_name}/external/${var.environment}/openjii_data_backups/centrum_raw_data"
        "ENVIRONMENT"     = upper(var.environment)
      }
    }
  ]

  # Configure Slack notifications
  webhook_notifications = {
    on_failure = [
      module.slack_notification_destination.notification_destination_id
    ]
    on_start = [
      module.slack_notification_destination.notification_destination_id
    ]
  }

  permissions = [
    {
      principal_application_id = module.node_service_principal.service_principal_application_id
      permission_level         = "CAN_MANAGE_RUN"
    }
  ]

  providers = {
    databricks.workspace = databricks.workspace
  }

  depends_on = [module.centrum_pipeline]
}

module "experiment_provisioning_job" {
  source = "../../modules/databricks/job"

  name        = "Experiment-Provisioning-Job-PROD"
  description = "Creates Delta Live Tables pipelines for experiments and reports status to backend webhook"

  max_concurrent_runs           = 1
  use_serverless                = true
  continuous                    = false
  serverless_performance_target = "STANDARD"

  queue = {
    enabled = true
  }

  run_as = {
    service_principal_name = module.node_service_principal.service_principal_application_id
  }

  # Configure task retries
  task_retry_config = {
    retries                   = 3
    min_retry_interval_millis = 60000
    retry_on_timeout          = true
  }

  tasks = [
    {
      key           = "experiment_pipeline_create"
      task_type     = "notebook"
      compute_type  = "serverless"
      notebook_path = "/Workspace/Shared/notebooks/tasks/experiment_pipeline_create_task"

      parameters = {
        "experiment_id"            = "{{experiment_id}}"
        "experiment_name"          = "{{experiment_name}}"
        "experiment_pipeline_path" = "/Workspace/Shared/notebooks/pipelines/experiment_pipeline"
        "catalog_name"             = module.databricks_catalog.catalog_name
        "central_schema"           = "centrum"
        "environment"              = upper(var.environment)
        "slack_channel"            = var.slack_channel
      }
    },
    {
      key           = "experiment_status_update"
      task_type     = "notebook"
      compute_type  = "serverless"
      notebook_path = "/Workspace/Shared/notebooks/tasks/experiment_status_update_task"

      parameters = {
        "experiment_id"       = "{{experiment_id}}"
        "job_run_id"          = "{{job.run_id}}"
        "task_run_id"         = "{{task.run_id}}"
        "create_result_state" = "{{tasks.experiment_pipeline_create.result_state}}"
        "pipeline_id"         = "{{tasks.experiment_pipeline_create.values.pipeline_id}}"
        "schema_name"         = "{{tasks.experiment_pipeline_create.values.schema_name}}"
        "webhook_url"         = "https://${module.route53.api_domain}${var.backend_status_update_webhook_path}"
        "key_scope"           = module.experiment_secret_scope.scope_name
      }

      depends_on = "experiment_pipeline_create"
    },
  ]

  # Configure Slack notifications
  webhook_notifications = {
    on_failure = [
      module.slack_notification_destination.notification_destination_id
    ]
  }

  permissions = [
    {
      principal_application_id = module.node_service_principal.service_principal_application_id
      permission_level         = "CAN_MANAGE_RUN"
    }
  ]

  providers = {
    databricks.workspace = databricks.workspace
  }
}

module "enriched_tables_refresh_job" {
  source = "../../modules/databricks/job"

  name        = "Enriched-Tables-Refresh-Job-PROD"
  description = "Refreshes enriched tables across experiment pipelines when metadata changes (e.g., user profile updates)"

  max_concurrent_runs           = 1
  use_serverless                = true
  continuous                    = false
  serverless_performance_target = "STANDARD"

  # Enable job queueing
  queue = {
    enabled = true
  }

  run_as = {
    service_principal_name = module.node_service_principal.service_principal_application_id
  }

  # Configure task retries
  task_retry_config = {
    retries                   = 2
    min_retry_interval_millis = 60000
    retry_on_timeout          = true
  }

  tasks = [
    {
      key           = "refresh_enriched_tables"
      task_type     = "notebook"
      compute_type  = "serverless"
      notebook_path = "/Workspace/Shared/notebooks/tasks/enriched_tables_refresh_task"

      parameters = {
        metadata_key         = "{{metadata_key}}"
        metadata_value       = "{{metadata_value}}"
        catalog_name         = module.databricks_catalog.catalog_name
        central_schema       = "centrum"
        central_silver_table = "clean_data"
        environment          = upper(var.environment)
      }
    }
  ]

  # Configure Slack notifications
  webhook_notifications = {
    on_failure = [
      module.slack_notification_destination.notification_destination_id
    ]
  }

  permissions = [
    {
      principal_application_id = module.node_service_principal.service_principal_application_id
      permission_level         = "CAN_MANAGE_RUN"
    }
  ]

  providers = {
    databricks.workspace = databricks.workspace
  }
}

module "ambyte_processing_job" {
  source = "../../modules/databricks/job"

  name        = "Ambyte-Processing-Job-PROD"
  description = "Processes raw ambyte trace files and saves them in the respective volume in parquet format"

  max_concurrent_runs           = 1 # Limit concurrent runs when queueing is enabled
  use_serverless                = true
  continuous                    = false
  serverless_performance_target = "STANDARD"

  # Enable job queueing
  queue = {
    enabled = true
  }

  run_as = {
    service_principal_name = module.node_service_principal.service_principal_application_id
  }

  # Configure task retries
  task_retry_config = {
    retries                   = 2
    min_retry_interval_millis = 60000
    retry_on_timeout          = true
  }

  tasks = [
    {
      key           = "process_ambyte_data"
      task_type     = "notebook"
      compute_type  = "serverless"
      notebook_path = "/Workspace/Shared/notebooks/tasks/ambyte_processing_task"

      parameters = {
        EXPERIMENT_ID     = "{{EXPERIMENT_ID}}"
        EXPERIMENT_NAME   = "{{EXPERIMENT_NAME}}"
        EXPERIMENT_SCHEMA = "{{EXPERIMENT_SCHEMA}}"
        UPLOAD_DIRECTORY  = "{{UPLOAD_DIRECTORY}}"
        YEAR_PREFIX       = "{{YEAR_PREFIX}}"
        CATALOG_NAME      = module.databricks_catalog.catalog_name
        ENVIRONMENT       = upper(var.environment)
      }
    }
  ]

  # Configure Slack notifications
  webhook_notifications = {
    on_failure = [
      module.slack_notification_destination.notification_destination_id
    ]
  }

  permissions = [
    {
      principal_application_id = module.node_service_principal.service_principal_application_id
      permission_level         = "CAN_MANAGE_RUN"
    }
  ]

  providers = {
    databricks.workspace = databricks.workspace
  }
}

module "aurora_db" {
  source                 = "../../modules/aurora_db"
  cluster_identifier     = "open-jii-${var.environment}-db-cluster"
  database_name          = "openjii_${var.environment}_db"
  master_username        = "openjii_${var.environment}_admin"
  db_subnet_group_name   = module.vpc.db_subnet_group_name
  vpc_security_group_ids = [module.vpc.aurora_security_group_id]

  environment              = var.environment
  max_capacity             = 1.0
  min_capacity             = 0
  seconds_until_auto_pause = 1800
  backup_retention_period  = 6
  skip_final_snapshot      = false
}

# Authentication secrets
module "auth_secrets" {
  source = "../../modules/secrets-manager"

  name        = "openjii-auth-secrets-${var.environment}"
  description = "Authentication and OAuth secrets for the openJII services"

  # Store secrets as JSON using variables
  secret_string = jsonencode({
    AUTH_SECRET        = var.auth_secret
    AUTH_GITHUB_ID     = var.github_oauth_client_id
    AUTH_GITHUB_SECRET = var.github_oauth_client_secret
    AUTH_ORCID_ID      = var.orcid_oauth_client_id
    AUTH_ORCID_SECRET  = var.orcid_oauth_client_secret
  })

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
    SecretType  = "authentication"
  }
}

# Databricks API secrets
module "databricks_secrets" {
  source = "../../modules/secrets-manager"

  name        = "openjii-databricks-secrets-${var.environment}"
  description = "Databricks connection secrets for the openJII services"

  # Store secrets as JSON using variables
  secret_string = jsonencode({
    DATABRICKS_HOST                           = module.databricks_workspace.workspace_url
    DATABRICKS_CLIENT_ID                      = module.node_service_principal.service_principal_application_id
    DATABRICKS_CLIENT_SECRET                  = module.node_service_principal.service_principal_secret_value
    DATABRICKS_EXPERIMENT_PROVISIONING_JOB_ID = module.experiment_provisioning_job.job_id
    DATABRICKS_AMBYTE_PROCESSING_JOB_ID       = module.ambyte_processing_job.job_id
    DATABRICKS_ENRICHED_TABLES_REFRESH_JOB_ID = module.enriched_tables_refresh_job.job_id
    DATABRICKS_WAREHOUSE_ID                   = var.backend_databricks_warehouse_id
    DATABRICKS_WEBHOOK_API_KEY_ID             = var.backend_webhook_api_key_id
    DATABRICKS_WEBHOOK_SECRET                 = var.backend_webhook_secret
    DATABRICKS_WEBHOOK_API_KEY                = var.backend_webhook_api_key
  })

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
    SecretType  = "databricks"
  }
}

# Contentful secrets
module "contentful_secrets" {
  source = "../../modules/secrets-manager"

  name        = "openjii-contentful-secrets-${var.environment}"
  description = "Contentful API secrets for the openJII services"

  # Store secrets as JSON using variables
  secret_string = jsonencode({
    CONTENTFUL_SPACE_ID             = var.contentful_space_id
    CONTENTFUL_ACCESS_TOKEN         = var.contentful_access_token
    CONTENTFUL_PREVIEW_ACCESS_TOKEN = var.contentful_preview_access_token
    CONTENTFUL_PREVIEW_SECRET       = var.contentful_preview_secret
  })

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "web"
    SecretType  = "contentful"
  }
}

# SES Email Service for transactional emails
module "ses" {
  source = "../../modules/ses"

  region                 = var.aws_region
  domain_name            = var.domain_name
  subdomain              = "mail"
  environment            = var.environment
  use_environment_prefix = false
  route53_zone_id        = module.route53.route53_zone_id

  allowed_from_addresses = [
    "auth@mail.${var.domain_name}",
    "notifications@mail.${var.domain_name}",
  ]

  create_smtp_user            = true
  enable_event_publishing     = true
  enable_dmarc_reports        = true
  dmarc_report_retention_days = 90

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "email"
  }
}

# SES SMTP secrets for application use
module "ses_secrets" {
  source = "../../modules/secrets-manager"

  name        = "openjii-ses-secrets-${var.environment}"
  description = "SES SMTP credentials for transactional email sending"

  # Store SES SMTP credentials as JSON
  secret_string = jsonencode({
    AUTH_EMAIL_SERVER    = module.ses.auth_email_server
    AUTH_EMAIL_FROM      = "auth@mail.${var.domain_name}"
    BACKEND_EMAIL_SERVER = module.ses.auth_email_server
    BACKEND_EMAIL_FROM   = "notifications@mail.${var.domain_name}"
  })

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "email"
    SecretType  = "ses"
  }
}

# WAF for OpenNext Web Application
module "opennext_waf" {
  source = "../../modules/waf"

  service_name       = "opennext"
  environment        = var.environment
  rate_limit         = 500
  log_retention_days = 30

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "frontend"
  }
}

# OpenNext Next.js Application Infrastructure
module "opennext" {
  source = "../../modules/opennext"

  project_name = "open-jii"
  environment  = var.environment
  region       = var.aws_region

  # Domain configuration - now uncommented and connected
  domain_name     = module.route53.environment_domain
  certificate_arn = module.route53.cloudfront_certificate_arns["web"]
  hosted_zone_id  = module.route53.route53_zone_id

  function_url_authorization_type = "AWS_IAM"

  # WAF integration
  waf_acl_id = module.opennext_waf.cloudfront_web_acl_arn

  # Logging configuration
  enable_logging = true
  log_bucket     = module.logs_bucket.bucket_id

  server_environment_variables = {
    COOKIE_DOMAIN            = ".${var.domain_name}"
    NODE_ENV                 = "production"
    ENVIRONMENT_PREFIX       = var.environment
    NEXT_PUBLIC_POSTHOG_KEY  = var.posthog_key
    NEXT_PUBLIC_POSTHOG_HOST = var.posthog_host
  }

  # Performance configuration
  enable_lambda_warming = true
  price_class           = "PriceClass_100"

  # Secrets Manager integration
  contentful_secret_arn = module.contentful_secrets.secret_arn

  # Monitoring configuration
  enable_cloudwatch_logs = true
  log_retention_days     = 14
  enable_xray_tracing    = false

  # Resource configuration
  server_memory_size     = 1024
  image_memory_size      = 1536
  revalidate_memory_size = 512
  warmer_memory_size     = 512

  # DynamoDB configuration
  dynamodb_billing_mode         = "PAY_PER_REQUEST"
  enable_point_in_time_recovery = true

  # SQS configuration
  enable_dlq        = true
  max_receive_count = 3

  tags = {
    Project     = "open-jii"
    Environment = var.environment
    Component   = "nextjs-app"
    ManagedBy   = "terraform"
  }
}

module "migration_runner_ecr" {
  source = "../../modules/ecr"

  aws_region  = var.aws_region
  environment = var.environment

  repository_name               = "db-migration-runner-ecr"
  service_name                  = "db-migration-runner"
  enable_vulnerability_scanning = true
  encryption_type               = "KMS"
  image_tag_mutability          = "MUTABLE"

  #ci_cd_role_arn = module.iam_oidc.role_arn

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "database-migrations"
  }
}

module "migration_runner_ecs" {
  source = "../../modules/ecs"

  region      = var.aws_region
  environment = var.environment

  create_ecs_service = false
  service_name       = "db-migration-runner"

  repository_url = module.migration_runner_ecr.repository_url
  repository_arn = module.migration_runner_ecr.repository_arn

  security_groups = [module.vpc.migration_task_security_group_id]
  subnets         = module.vpc.private_subnets
  vpc_id          = module.vpc.vpc_id

  desired_count      = 1
  cpu                = 256
  memory             = 512
  use_spot_instances = false
  enable_autoscaling = false

  enable_container_healthcheck = false
  enable_circuit_breaker       = true

  log_group_name     = "/aws/ecs/db-migration-runner-${var.environment}"
  log_retention_days = 30


  # Secrets configuration
  secrets = [
    {
      name      = "DB_CREDENTIALS"
      valueFrom = module.aurora_db.master_user_secret_arn
    }
  ]

  # Environment variables for the migration runner
  environment_variables = [
    {
      name  = "DB_HOST"
      value = module.aurora_db.cluster_endpoint
    },
    {
      name  = "DB_NAME"
      value = module.aurora_db.database_name
    },
    {
      name  = "DB_PORT"
      value = module.aurora_db.cluster_port
    },
    {
      name  = "LOG_LEVEL"
      value = "debug"
    },
  ]

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "database-migrations"
  }
}

module "backend_ecr" {
  source = "../../modules/ecr"

  aws_region                    = var.aws_region
  environment                   = var.environment
  repository_name               = "open-jii-backend"
  service_name                  = "backend"
  max_image_count               = 10
  enable_vulnerability_scanning = true
  encryption_type               = "KMS"
  image_tag_mutability          = "MUTABLE"

  #ci_cd_role_arn = module.iam_oidc.role_arn

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

module "backend_alb" {
  source = "../../modules/alb"

  service_name      = "backend"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnets
  container_port    = var.backend_container_port
  security_groups   = [module.vpc.alb_security_group_id]
  environment       = var.environment

  # Health check configuration
  health_check_path                = "/health"
  health_check_timeout             = 5
  health_check_interval            = 90
  health_check_healthy_threshold   = 3
  health_check_unhealthy_threshold = 3
  health_check_matcher             = "200-299"

  # SSL/TLS configuration for HTTPS - Uses the certificate from the default region (e.g., eu-central-1)
  certificate_arn         = module.route53.regional_services_certificate_arn
  cloudfront_header_value = var.api_cloudfront_header_value

  # Enable access logs for better security and troubleshooting
  enable_access_logs = true
  access_logs_bucket = module.logs_bucket.bucket_id

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

module "backend_ecs" {
  source = "../../modules/ecs"

  region      = var.aws_region
  environment = var.environment

  # Unlike migration runner, we want a long-running service
  create_ecs_service = true
  service_name       = "backend"

  repository_url = module.backend_ecr.repository_url
  repository_arn = module.backend_ecr.repository_arn

  # Networking configuration
  vpc_id          = module.vpc.vpc_id
  subnets         = module.vpc.private_subnets
  security_groups = [module.vpc.ecs_security_group_id]

  # Container configuration
  container_port = var.backend_container_port

  # Task size
  cpu               = 512  # 0.5 vCPU
  memory            = 1024 # 1 GB
  container_cpu     = 512  # 0.5 vCPU
  container_memory  = 1024 # 1 GB
  ephemeral_storage = 21   # Minimum size (21 GiB)

  # Load balancer integration
  target_group_arn = module.backend_alb.target_group_arn

  # Auto-scaling settings
  enable_autoscaling = true
  min_capacity       = 1  # Scale down to 1 task
  max_capacity       = 3  # Scale up to 3 tasks
  cpu_threshold      = 80 # Scale out at 80% CPU usage

  # Mixed capacity strategy for cost optimization and stability
  enable_mixed_capacity = true
  fargate_spot_weight   = 0.8 # 80% of tasks on Spot for dev environment (cost saving)
  fargate_base_count    = 1   # Keep at least 1 task on regular Fargate for stability 
  desired_count         = 1

  # Container health checks
  enable_container_healthcheck = true
  health_check_path            = "/health"

  # Deployment configuration
  enable_circuit_breaker               = true
  enable_circuit_breaker_with_rollback = true

  # Logs configuration
  log_group_name     = "/aws/ecs/backend-service-${var.environment}"
  log_retention_days = 30

  # Secrets configuration
  secrets = [
    {
      name      = "AUTH_GITHUB_ID"
      valueFrom = "${module.auth_secrets.secret_arn}:AUTH_GITHUB_ID::"
    },
    {
      name      = "AUTH_GITHUB_SECRET"
      valueFrom = "${module.auth_secrets.secret_arn}:AUTH_GITHUB_SECRET::"
    },
    {
      name      = "AUTH_ORCID_ID"
      valueFrom = "${module.auth_secrets.secret_arn}:AUTH_ORCID_ID::"
    },
    {
      name      = "AUTH_ORCID_SECRET"
      valueFrom = "${module.auth_secrets.secret_arn}:AUTH_ORCID_SECRET::"
    },
    {
      name      = "AUTH_SECRET"
      valueFrom = "${module.auth_secrets.secret_arn}:AUTH_SECRET::"
    },
    {
      name      = "AUTH_EMAIL_SERVER"
      valueFrom = "${module.ses_secrets.secret_arn}:AUTH_EMAIL_SERVER::"
    },
    {
      name      = "AUTH_EMAIL_FROM"
      valueFrom = "${module.ses_secrets.secret_arn}:AUTH_EMAIL_FROM::"
    },
    {
      name      = "DATABRICKS_CLIENT_ID"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_CLIENT_ID::"
    },
    {
      name      = "DATABRICKS_CLIENT_SECRET"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_CLIENT_SECRET::"
    },
    {
      name      = "DATABRICKS_HOST"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_HOST::"
    },
    {
      name      = "DATABRICKS_EXPERIMENT_PROVISIONING_JOB_ID"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_EXPERIMENT_PROVISIONING_JOB_ID::"
    },
    {
      name      = "DATABRICKS_AMBYTE_PROCESSING_JOB_ID"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_AMBYTE_PROCESSING_JOB_ID::"
    },
    {
      name      = "DATABRICKS_ENRICHED_TABLES_REFRESH_JOB_ID"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_ENRICHED_TABLES_REFRESH_JOB_ID::"
    },
    {
      name      = "DATABRICKS_WAREHOUSE_ID"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WAREHOUSE_ID::"
    },
    {
      name      = "DATABRICKS_WEBHOOK_API_KEY_ID"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WEBHOOK_API_KEY_ID::"
    },
    {
      name      = "DATABRICKS_WEBHOOK_API_KEY"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WEBHOOK_API_KEY::"
    },
    {
      name      = "DATABRICKS_WEBHOOK_SECRET"
      valueFrom = "${module.databricks_secrets.secret_arn}:DATABRICKS_WEBHOOK_SECRET::"
    },
    {
      name      = "DB_CREDENTIALS"
      valueFrom = module.aurora_db.master_user_secret_arn
    },
    {
      name      = "EMAIL_SERVER"
      valueFrom = "${module.ses_secrets.secret_arn}:BACKEND_EMAIL_SERVER::"
    },
    {
      name      = "EMAIL_FROM"
      valueFrom = "${module.ses_secrets.secret_arn}:BACKEND_EMAIL_FROM::"
    },
  ]

  # Environment variables for the backend service
  environment_variables = [
    {
      name  = "DATABRICKS_CATALOG_NAME"
      value = module.databricks_catalog.catalog_name
    },
    {
      name  = "DB_HOST"
      value = module.aurora_db.cluster_endpoint
    },
    {
      name  = "DB_NAME"
      value = module.aurora_db.database_name
    },
    {
      name  = "DB_PORT"
      value = module.aurora_db.cluster_port
    },
    {
      name  = "LOG_LEVEL"
      value = "debug"
    },
    {
      name  = "CORS_ENABLED"
      value = "true"
    },
    {
      name  = "CORS_ORIGINS"
      value = "https://${module.route53.environment_domain}"
    },
    {
      name  = "COOKIE_DOMAIN"
      value = ".${var.domain_name}"
    },
    {
      name  = "ENVIRONMENT_PREFIX"
      value = var.environment
    },
    {
      name  = "AWS_LOCATION_PLACE_INDEX_NAME"
      value = module.location_service.place_index_name
    },
    {
      name  = "EMAIL_BASE_URL"
      value = "https://${module.route53.environment_domain}"
    },
    {
      name  = "AWS_REGION"
      value = var.aws_region
    },
    {
      name  = "POSTHOG_KEY"
      value = var.posthog_key
    },
    {
      name  = "POSTHOG_HOST"
      value = var.posthog_host
    }
  ]

  # Additional IAM policies for the task role
  additional_task_role_policy_arns = [
    module.location_service.iam_policy_arn
  ]

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

module "backend_waf" {
  source = "../../modules/waf"

  service_name       = "backend"
  environment        = var.environment
  rate_limit         = 500
  log_retention_days = 30

  large_body_bypass_routes = [
    {
      search_string         = "/upload"
      positional_constraint = "ENDS_WITH"
      method                = "POST"
    },
    {
      search_string         = "/api/v1/macros"
      positional_constraint = "STARTS_WITH"
      method                = "POST"
    }
  ]

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

# # CloudFront distribution in front of the backend API
module "backend_cloudfront" {
  source = "../../modules/backend-cloudfront"

  service_name    = "backend"
  environment     = var.environment
  alb_domain_name = module.backend_alb.alb_dns_name

  # Custom header for ALB protection
  custom_header_value = var.api_cloudfront_header_value

  # CloudFront settings
  price_class = "PriceClass_100" # Use only North America and Europe
  default_ttl = 0                # API shouldn't cache by default
  max_ttl     = 0                # API shouldn't cache by default

  # Security settings
  certificate_arn = module.route53.cloudfront_certificate_arns["api"] # Use the us-east-1 certificate for 'api'
  custom_domain   = module.route53.api_domain
  waf_acl_id      = module.backend_waf.cloudfront_web_acl_arn

  # Logging settings
  enable_logging = true
  log_bucket     = module.logs_bucket.bucket_id

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "backend"
  }
}

# WAF for Documentation Site
module "docs_waf" {
  source = "../../modules/waf"

  service_name       = "docs"
  environment        = var.environment
  rate_limit         = 500
  log_retention_days = 30

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "Terraform"
    Component   = "documentation-waf"
  }
}

# # CloudFront distribution for documentation site
module "docs_cloudfront" {
  source          = "../../modules/cloudfront"
  aws_region      = var.aws_region
  bucket_name     = module.docusaurus_s3.bucket_name
  certificate_arn = module.route53.cloudfront_certificate_arns["docs"]
  custom_domain   = module.route53.docs_domain
  waf_acl_id      = module.docs_waf.cloudfront_web_acl_arn

  # TODO: Add tags, logging configuration
}

# Route53 configuration for openJII services
module "route53" {
  source = "../../modules/route53"

  domain_name            = var.domain_name
  environment            = var.environment
  use_environment_prefix = false # Prod owns the root domain (openjii.org)

  # Input for CloudFront domains that need us-east-1 certificates
  cloudfront_domain_configs = {
    "api"  = "api.${var.domain_name}"
    "docs" = "docs.${var.domain_name}"
    "web"  = var.domain_name
  }

  cloudfront_records = {
    # Root Domain Record
    "" = {
      domain_name    = module.opennext.cloudfront_domain_name
      hosted_zone_id = module.opennext.cloudfront_hosted_zone_id
    },
    # Documentation Site Record
    "docs" = {
      domain_name    = module.docs_cloudfront.cloudfront_distribution_domain_name
      hosted_zone_id = module.docs_cloudfront.cloudfront_hosted_zone_id
    },
    # Backend API Record
    "api" = {
      domain_name    = module.backend_cloudfront.cloudfront_distribution_domain_name
      hosted_zone_id = module.backend_cloudfront.cloudfront_hosted_zone_id
    }
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Create NS delegation record for dev.domain_name in prod's hosted zone
module "dev_subdomain_delegation" {
  source = "../../modules/route53-delegation"

  parent_zone_id = module.route53.route53_zone_id
  subdomain      = "dev.${var.domain_name}"

  # Use hardcoded nameservers from tfvars
  name_servers = split(",", var.dev_nameservers)
}

# AWS Location Service for search and geocoding
module "location_service" {
  source = "../../modules/location-service"

  place_index_name = "open-jii-${var.environment}-places-index"
  data_source      = "Esri"
  description      = "Place Index for openJII search and geocoding operations"
  intended_use     = "SingleUse"
  iam_policy_name  = "OpenJII-${var.environment}-LocationServicePolicy"

  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "location-service"
  }
}

# OpenNext Infrastructure Outputs
module "ssm_opennext_outputs" {
  source = "../../modules/ssm-parameter"

  parameters = {
    assets_bucket = {
      name        = "/opennext/${var.environment}/assets-bucket"
      value       = module.opennext.assets_bucket_name
      description = "S3 bucket name for OpenNext static assets"
      type        = "String"
    }
    cache_bucket = {
      name        = "/opennext/${var.environment}/cache-bucket"
      value       = module.opennext.cache_bucket_name
      description = "S3 bucket name for OpenNext cache"
      type        = "String"
    }
    # Frontend Lambdas Outputs
    server_function = {
      name        = "/opennext/${var.environment}/server-function"
      value       = module.opennext.server_function_name
      description = "Lambda function name for OpenNext server"
      type        = "String"
    }
    image_function = {
      name        = "/opennext/${var.environment}/image-function"
      value       = module.opennext.image_function_name
      description = "Lambda function name for OpenNext image optimization"
      type        = "String"
    }
    revalidation_function = {
      name        = "/opennext/${var.environment}/revalidation-function"
      value       = module.opennext.revalidation_function_name
      description = "Lambda function name for OpenNext revalidation"
      type        = "String"
    }
    warmer_function = {
      name        = "/opennext/${var.environment}/warmer-function"
      value       = module.opennext.warmer_function_name
      description = "Lambda function name for OpenNext warmer"
      type        = "String"
    }
    cloudfront_distribution_id = {
      name        = "/opennext/${var.environment}/cloudfront-distribution-id"
      value       = module.opennext.cloudfront_distribution_id
      description = "CloudFront distribution ID for OpenNext"
      type        = "String"
    }
    # Backend ECS Outputs
    backend_task_definition_family = {
      name        = "/backend/${var.environment}/ecs/task-definition-family"
      value       = module.backend_ecs.ecs_task_definition_family
      description = "ECS task definition family for backend service"
      type        = "String"
      tier        = "Standard"
    }
    backend_task_definition_arn = {
      name        = "/backend/${var.environment}/ecs/task-definition-arn"
      value       = module.backend_ecs.ecs_task_definition_arn
      description = "Full ARN (family + revision) of backend ECS task definition"
      type        = "String"
      tier        = "Standard"
    }
    backend_container_name = {
      name        = "/backend/${var.environment}/ecs/container-name"
      value       = module.backend_ecs.container_name
      description = "Primary container name for backend task definition"
      type        = "String"
      tier        = "Standard"
    }
    dynamodb_table = {
      name        = "/opennext/${var.environment}/dynamodb-table-name"
      value       = module.opennext.dynamodb_table_name
      description = "DynamoDB table name for OpenNext cache/revalidation"
      type        = "String"
    }
    # Database Migration ECS Outputs
    migration_runner_ecr_repository = {
      name        = "/migration/${var.environment}/ecr-repository-name"
      value       = module.migration_runner_ecr.repository_name
      description = "ECR repository name for database migrations Docker images"
      type        = "String"
    }
    migration_runner_ecs_cluster = {
      name        = "/migration/${var.environment}/ecs-cluster-name"
      value       = module.migration_runner_ecs.ecs_cluster_name
      description = "ECS cluster name for running database migrations"
      type        = "String"
    }
    migration_runner_task_definition = {
      name        = "/migration/${var.environment}/task-definition-family"
      value       = module.migration_runner_ecs.ecs_task_definition_family
      description = "Task definition family for database migrations"
      type        = "String"
    }
    migration_runner_container = {
      name        = "/migration/${var.environment}/container-name"
      value       = module.migration_runner_ecs.container_name
      description = "Name of the primary container in the ECS task definition for migrations"
      type        = "String"
    }
    migration_runner_subnets = {
      name        = "/migration/${var.environment}/subnets"
      value       = jsonencode(module.vpc.private_subnets)
      description = "Subnet IDs for the database migration task"
      type        = "String"
    }
    migration_runner_security_group = {
      name        = "/migration/${var.environment}/security-group-id"
      value       = module.vpc.migration_task_security_group_id
      description = "Security group ID for the database migration task"
      type        = "String"
    }
    # Docusaurus Site Outputs
    docs_bucket = {
      name        = "/docs/${var.environment}/docs-bucket"
      value       = module.docusaurus_s3.bucket_name
      description = "S3 bucket name for Docusaurus static assets"
      type        = "String"
    }
    docs_cloudfront_distribution_id = {
      name        = "/docs/${var.environment}/cloudfront-distribution-id"
      value       = module.docs_cloudfront.distribution_id
      description = "CloudFront distribution ID for documentation site"
      type        = "String"
    }
  }
  tags = {
    Environment = var.environment
    Project     = "open-jii"
    ManagedBy   = "terraform"
    Component   = "ssm-parameters"
  }
}