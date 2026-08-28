export type EnvTarget = "backend" | "web";

interface EnvVar {
  key: string;
  local: "set" | "must-be-unset";
  sentinel?: string;
  targets: readonly EnvTarget[];
}

const backend = ["backend"] as const;
const web = ["web"] as const;
const both = ["backend", "web"] as const;
const set = "set" as const;
const unset = "must-be-unset" as const;
const env = (
  key: string,
  local: EnvVar["local"],
  sentinel: string | undefined,
  targets: readonly EnvTarget[],
): EnvVar => ({ key, local, sentinel, targets });

export const envManifest: readonly EnvVar[] = [
  env("DATABASE_URL", set, "postgresql://postgres:postgres@localhost:5432/openjii_local", backend),
  env("DB_HOST", set, undefined, backend),
  env("DB_PORT", set, undefined, backend),
  env("DB_NAME", set, undefined, backend),
  env("DB_CREDENTIALS", set, undefined, backend),
  env("AUTH_SECRET", set, "local-dev-secret-change-me-000000000000", backend),
  env("AUTH_EMAIL_SERVER", unset, undefined, backend),
  env("AUTH_EMAIL_FROM", unset, undefined, backend),
  env("AUTH_GITHUB_ID", set, undefined, backend),
  env("AUTH_GITHUB_SECRET", set, undefined, backend),
  env("AUTH_ORCID_ID", set, undefined, backend),
  env("AUTH_ORCID_SECRET", set, undefined, backend),
  env("AUTH_ORCID_ENVIRONMENT", set, undefined, backend),
  env("ENVIRONMENT_PREFIX", set, "dev", backend),
  env("NEXT_PUBLIC_BASE_URL", set, "http://localhost:3000", both),
  env("NEXT_PUBLIC_API_URL", set, "http://localhost:3020", both),
  // Keep unset: localhost sessions and passkey RP-ID validation require a host-only cookie.
  env("COOKIE_DOMAIN", unset, undefined, both),
  env("NODE_ENV", set, "development", both),

  env("DATABRICKS_HOST", set, "http://127.0.0.1:9", backend),
  env("DATABRICKS_CLIENT_ID", set, "local-disabled", backend),
  env("DATABRICKS_CLIENT_SECRET", set, "local-disabled", backend),
  env("DATABRICKS_DATA_EXPORT_JOB_ID", set, "0", backend),
  env("DATABRICKS_DATA_UPLOAD_JOB_ID", set, "0", backend),
  env("DATABRICKS_WAREHOUSE_ID", set, "local-disabled", backend),
  env("DATABRICKS_CATALOG_NAME", set, "local", backend),
  env("DATABRICKS_CENTRUM_SCHEMA_NAME", set, "local", backend),
  env("DATABRICKS_METRICS_SCHEMA_NAME", set, "metrics", backend),
  env("DATABRICKS_RAW_DATA_TABLE_NAME", set, "raw_data", backend),
  env("DATABRICKS_DEVICE_DATA_TABLE_NAME", set, "device_data", backend),
  env("DATABRICKS_MACRO_DATA_TABLE_NAME", set, "macro_data", backend),
  env("DATABRICKS_UPLOADED_DATA_TABLE_NAME", set, "experiment_uploaded_data", backend),
  env("DATABRICKS_WEBHOOK_API_KEY_ID", set, "local-webhook", backend),
  env("DATABRICKS_WEBHOOK_API_KEY", set, "local-disabled", backend),
  env("DATABRICKS_WEBHOOK_SECRET", set, "local-disabled", backend),

  env("AWS_REGION", set, "eu-west-1", backend),
  env("AWS_LOCATION_PLACE_INDEX_NAME", set, "local-disabled", backend),
  env(
    "AWS_COGNITO_IDENTITY_POOL_ID",
    set,
    "eu-west-1:00000000-0000-0000-0000-000000000000",
    backend,
  ),
  env("AWS_COGNITO_DEVELOPER_PROVIDER_NAME", set, "local.openjii", backend),
  env("AWS_IOT_POLICY_NAMES", set, "local-disabled", backend),
  env("AWS_IOT_JOBS_POLICY_NAME", set, "local-disabled", backend),
  env("AWS_IOT_DEVICE_THING_TYPE_NAME", set, "local-disabled", backend),
  env("AWS_IOT_DEVICE_THING_GROUP_NAME", set, "local-disabled", backend),
  env("AWS_LAMBDA_MACRO_SANDBOX_PYTHON_FUNCTION_NAME", set, "local-disabled-python", backend),
  env(
    "AWS_LAMBDA_MACRO_SANDBOX_JAVASCRIPT_FUNCTION_NAME",
    set,
    "local-disabled-javascript",
    backend,
  ),
  env("AWS_LAMBDA_MACRO_SANDBOX_R_FUNCTION_NAME", set, "local-disabled-r", backend),
  env("AWS_IOT_ARCHIVE_BUCKET_NAME", set, "local-openjii-iot-archive", backend),
  env("AWS_IOT_LARGE_PAYLOAD_BUCKET_NAME", set, "local-openjii-large-payloads", backend),
  env("AWS_SESSION_TOKEN", set, undefined, web),
  // Keep unset: any truthy value enables Lambda secrets-extension retries.
  env("AWS_LAMBDA_FUNCTION_NAME", unset, undefined, web),

  // Firmware rollout reads public GitHub repositories; the token only raises the
  // anonymous rate limit, so it stays optional and out of the generated example.
  env("GITHUB_TOKEN", set, undefined, backend),
  env("FIRMWARE_REPO_AMBYTE", unset, undefined, backend),
  env("FIRMWARE_REPO_AMBIT", unset, undefined, backend),
  env("FIRMWARE_REPO_MINIPAR", unset, undefined, backend),

  env("EMAIL_BASE_URL", set, "http://localhost:3000", backend),
  // The sentinel is intentionally closed; no local SMTP service listens on port 9.
  env("EMAIL_SERVER", set, "smtp://127.0.0.1:9", backend),
  env("EMAIL_FROM", set, "noreply@localhost", backend),

  // Mailchimp configuration is all-or-none; keep every key unset locally.
  env("MAILCHIMP_API_KEY", unset, undefined, backend),
  env("MAILCHIMP_SERVER_PREFIX", unset, undefined, backend),
  env("MAILCHIMP_AUDIENCE_ID", unset, undefined, backend),
  env("MAILCHIMP_COMMUNITY_KIND", unset, undefined, backend),
  env("MAILCHIMP_COMMUNITY_ID", unset, undefined, backend),
  env("MAILCHIMP_COMMUNITY_NAME", unset, undefined, backend),

  env("POSTHOG_KEY", set, "phc_0000", backend),
  env("POSTHOG_HOST", set, "https://eu.i.posthog.com", backend),
  env("NEXT_PUBLIC_POSTHOG_KEY", set, "phc_0000", web),
  env("NEXT_PUBLIC_POSTHOG_HOST", set, "https://eu.i.posthog.com", web),
  env("NEXT_PUBLIC_POSTHOG_UI_HOST", set, "https://eu.posthog.com", web),

  env("LOG_LEVEL", set, "info", backend),
  env("PORT", set, "3020", backend),
  env("CORS_ENABLED", set, "true", backend),
  env("CORS_ORIGINS", set, "http://localhost:3000", backend),

  env("NEXT_PUBLIC_DOCS_URL", set, "http://localhost:3010", web),
  env("NEXT_PUBLIC_ENABLE_DEVTOOLS", set, "true", web),
  env("NEXT_PUBLIC_ENABLE_MOCK_DEVICES", set, "false", web),
  env("CONTENTFUL_SPACE_ID", set, undefined, web),
  env("CONTENTFUL_ACCESS_TOKEN", set, undefined, web),
  env("CONTENTFUL_PREVIEW_ACCESS_TOKEN", set, undefined, web),
  env("CONTENTFUL_PREVIEW_SECRET", set, undefined, web),
  env("CONTENTFUL_SPACE_ENVIRONMENT", set, "master", web),
  env("VERCEL_AUTOMATION_BYPASS_SECRET", set, undefined, web),
  env("CONTENTFUL_GRAPHQL_ENDPOINT", set, undefined, web),
  env("CONTENTFUL_SECRET_ARN", set, undefined, web),
];

export const envByKey = new Map(envManifest.map((entry) => [entry.key, entry]));
