// Core configuration
export interface DatabricksConfig {
  readonly host: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly jobId: string;
  readonly warehouseId: string;
  readonly catalogName: string;
}

// Authentication
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Health monitoring
export interface DatabricksHealthCheck {
  readonly healthy: boolean;
  readonly service: string;
}

// SQL statement execution types
export interface ExecuteStatementRequest {
  statement: string;
  warehouse_id: string;
  wait_timeout: string;
  schema: string;
  catalog: string;
  disposition: "INLINE" | "EXTERNAL_LINKS";
  format: "JSON_ARRAY" | "ARROW_STREAM" | "CSV";
  row_limit?: number;
  byte_limit?: number;
  on_wait_timeout?: "CONTINUE" | "CANCEL";
}

export interface StatementResponse {
  statement_id: string;
  status: {
    state:
      | "PENDING"
      | "RUNNING"
      | "SUCCEEDED"
      | "FAILED"
      | "CANCELED"
      | "CLOSED";
    error?: {
      message?: string;
      error_code?: string;
    };
  };
  manifest?: {
    schema: {
      column_count: number;
      columns: {
        name: string;
        position: number;
        type_name: string;
        type_text: string;
      }[];
    };
    total_row_count?: number;
    truncated?: boolean;
  };
  result?: {
    chunk_index: number;
    data_array: (string | null)[][];
    row_count: number;
    row_offset: number;
  };
}

export interface DatabricksExperimentAnalytics {
  columns: {
    name: string;
    type_name: string;
    type_text: string;
  }[];
  rows: (string | null)[][];
  totalRows: number;
  truncated: boolean;
}

// Common enums for type safety
export enum LifeCycleState {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  TERMINATING = "TERMINATING",
  TERMINATED = "TERMINATED",
  SKIPPED = "SKIPPED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export enum ResultState {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  TIMEDOUT = "TIMEDOUT",
  CANCELED = "CANCELED",
}

export enum PerformanceTarget {
  PERFORMANCE_OPTIMIZED = "PERFORMANCE_OPTIMIZED",
  STANDARD = "STANDARD",
}

export enum PauseStatus {
  PAUSED = "PAUSED",
  UNPAUSED = "UNPAUSED",
}

export enum SourceType {
  WORKSPACE = "WORKSPACE",
  GIT = "GIT",
}

export enum TaskRunCondition {
  ALL_SUCCESS = "ALL_SUCCESS",
  AT_LEAST_ONE_SUCCESS = "AT_LEAST_ONE_SUCCESS",
  NONE_FAILED = "NONE_FAILED",
  ALWAYS = "ALWAYS",
  ALL_FAILED = "ALL_FAILED",
  AT_LEAST_ONE_FAILED = "AT_LEAST_ONE_FAILED",
}

// Job execution interfaces
export interface DatabricksRunNowRequest {
  job_id: number;
  idempotency_token?: string;
  job_parameters?: Record<string, string>;
  only?: string[];
  performance_target?: PerformanceTarget;
  pipeline_params?: PipelineParams;
  queue?: QueueConfig;
  // Legacy - consider deprecating
  jar_params?: string[];
  python_params?: string[];
  spark_submit_params?: string[];
  python_named_params?: Record<string, string>;
}

export interface DatabricksJobRunResponse {
  run_id: number;
  number_in_job: number;
  start_time?: number;
  state?: JobRunState;
}

export interface JobRunState {
  life_cycle_state: LifeCycleState;
  result_state?: ResultState;
  state_message?: string;
}

// Job listing interfaces
export interface DatabricksJobsListRequest {
  limit?: number; // Max 100
  expand_tasks?: boolean;
  name?: string;
  page_token?: string;
}

export interface DatabricksJobsListResponse {
  jobs?: DatabricksJob[];
  next_page_token?: string;
  prev_page_token?: string;
}

// Core job interfaces
export interface DatabricksJob {
  job_id: number;
  creator_user_name?: string;
  created_time: number;
  settings: DatabricksJobSettings;
  has_more?: boolean;
  effective_budget_policy_id?: string;
}

export interface DatabricksJobSettings extends BaseJobConfiguration {
  name: string;
  tasks?: JobTask[];
  format?: "SINGLE_TASK" | "MULTI_TASK";
  description?: string;
  schedule?: ScheduleConfig;
  continuous?: ContinuousConfig;
  trigger?: TriggerConfig;
  git_source?: GitSourceConfig;
  parameters?: JobParameter[];
  tags?: Record<string, string>;
  edit_mode?: "UI_LOCKED" | "EDITABLE";
  deployment?: DeploymentConfig;
  environments?: EnvironmentConfig[];
}

// Shared configuration interfaces
interface BaseJobConfiguration {
  email_notifications?: NotificationSettings;
  webhook_notifications?: WebhookNotificationSettings;
  notification_settings?: GeneralNotificationSettings;
  timeout_seconds?: number;
  max_concurrent_runs?: number;
  job_clusters?: JobClusterConfig[];
  run_as?: RunAsConfig;
  health?: HealthConfig;
  performance_target?: PerformanceTarget;
  budget_policy_id?: string;
  queue?: QueueConfig;
}

interface NotificationSettings {
  on_start?: string[];
  on_success?: string[];
  on_failure?: string[];
  on_duration_warning_threshold_exceeded?: string[];
  no_alert_for_skipped_runs?: boolean;
  on_streaming_backlog_exceeded?: string[];
}

interface WebhookNotificationSettings {
  on_start?: WebhookConfig[][];
  on_success?: WebhookConfig[][];
  on_failure?: WebhookConfig[][];
  on_duration_warning_threshold_exceeded?: WebhookConfig[][];
  on_streaming_backlog_exceeded?: WebhookConfig[][];
}

interface GeneralNotificationSettings {
  no_alert_for_skipped_runs?: boolean;
  no_alert_for_canceled_runs?: boolean;
  alert_on_last_attempt?: boolean;
}

interface WebhookConfig {
  id: string;
}

interface QueueConfig {
  enabled: boolean;
}

interface JobClusterConfig {
  job_cluster_key: string;
  new_cluster: ClusterSpec;
}

interface RunAsConfig {
  user_name?: string;
  service_principal_name?: string;
}

interface ScheduleConfig {
  quartz_cron_expression: string;
  timezone_id: string;
  pause_status?: PauseStatus;
}

interface ContinuousConfig {
  pause_status: PauseStatus;
}

interface TriggerConfig {
  pause_status?: PauseStatus;
  file_arrival?: FileArrivalTrigger;
  periodic?: PeriodicTrigger;
}

interface FileArrivalTrigger {
  url: string;
  min_time_between_triggers_seconds?: number;
  wait_after_last_change_seconds?: number;
}

interface PeriodicTrigger {
  interval: number;
  unit: "MINUTES" | "HOURS" | "DAYS";
}

interface GitSourceConfig {
  git_url: string;
  git_provider: string;
  git_branch?: string;
  git_commit?: string;
  git_tag?: string;
  git_snapshot?: {
    used_commit: string;
  };
}

interface HealthConfig {
  rules: HealthRule[];
}

interface HealthRule {
  metric:
    | "RUN_DURATION_SECONDS"
    | "STREAMING_BACKLOG_BYTES"
    | "STREAMING_BACKLOG_RECORDS"
    | "STREAMING_BACKLOG_SECONDS"
    | "STREAMING_BACKLOG_FILES";
  op: "GREATER_THAN";
  value: number;
}

interface JobParameter {
  name: string;
  default?: string;
}

interface DeploymentConfig {
  kind: "BUNDLE";
  metadata_file_path?: string;
}

interface EnvironmentConfig {
  environment_key: string;
  spec: {
    client: string;
    dependencies: string[];
    [key: string]: any;
  };
}

interface PipelineParams {
  full_refresh?: boolean;
  [key: string]: any;
}

// Task definitions
export interface JobTask extends BaseTaskConfiguration {
  task_key: string;
  description?: string;
  depends_on?: TaskDependency[];

  // Compute configuration
  existing_cluster_id?: string;
  new_cluster?: ClusterSpec;
  job_cluster_key?: string;
  environment_key?: string;
  disable_auto_optimization?: boolean;

  // Task types (only one should be specified)
  notebook_task?: NotebookTask;
  spark_jar_task?: SparkJarTask;
  spark_python_task?: SparkPythonTask;
  spark_submit_task?: SparkSubmitTask;
  python_wheel_task?: PythonWheelTask;
  shell_command_task?: ShellCommandTask;
  pipeline_task?: PipelineTask;
  sql_task?: SqlTask;
  dbt_task?: DbtTask;
  condition_task?: ConditionTask;
  for_each_task?: ForEachTask;
  run_job_task?: RunJobTask;
  power_bi_task?: PowerBITask;
  clean_rooms_notebook_task?: CleanRoomsNotebookTask;
}

interface BaseTaskConfiguration {
  timeout_seconds?: number;
  max_retries?: number;
  min_retry_interval_millis?: number;
  retry_on_timeout?: boolean;
  run_if?: TaskRunCondition;
  libraries?: Library[];
  email_notifications?: NotificationSettings;
  webhook_notifications?: WebhookNotificationSettings;
  notification_settings?: GeneralNotificationSettings;
  health?: HealthConfig;
}

interface TaskDependency {
  task_key: string;
  outcome?: string;
}

// Task type definitions
interface NotebookTask {
  notebook_path: string;
  base_parameters?: Record<string, string>;
  source?: SourceType;
  warehouse_id?: string;
}

interface SparkJarTask {
  main_class_name: string;
  parameters?: string[];
  jar_uri?: string; // Deprecated
  run_as_repl?: boolean; // Deprecated
}

interface SparkPythonTask {
  python_file: string;
  parameters?: string[];
  source?: SourceType;
}

interface SparkSubmitTask {
  parameters?: string[];
}

interface PythonWheelTask {
  package_name: string;
  entry_point?: string;
  parameters?: string[];
  named_parameters?: Record<string, string>;
}

interface ShellCommandTask {
  command: string;
}

interface PipelineTask {
  pipeline_id: string;
  full_refresh?: boolean;
}

interface SqlTask {
  query?: SqlQuery;
  dashboard?: SqlDashboard;
  alert?: SqlAlert;
  file?: SqlFile;
  parameters?: Record<string, string>;
  warehouse_id?: string;
}

interface SqlQuery {
  query_id?: string;
}

interface SqlDashboard {
  dashboard_id?: string;
  custom_subject?: string;
  pause_subscriptions?: boolean;
  subscriptions?: any[];
}

interface SqlAlert {
  alert_id?: string;
  pause_subscriptions?: boolean;
  subscriptions?: any[];
}

interface SqlFile {
  path: string;
  source?: SourceType;
}

interface DbtTask {
  project_directory: string;
  commands?: string[];
  catalog?: string;
  schema?: string;
  warehouse_id?: string;
  profiles_directory?: string;
  profile?: string;
  target?: string;
  flags?: string;
  source?: SourceType;
}

interface ConditionTask {
  left: string;
  op:
    | "EQUAL_TO"
    | "GREATER_THAN"
    | "GREATER_THAN_OR_EQUAL"
    | "LESS_THAN"
    | "LESS_THAN_OR_EQUAL"
    | "NOT_EQUAL";
  right: string;
}

interface ForEachTask {
  concurrency?: number;
  inputs: string;
  task: any;
}

interface RunJobTask {
  job_id: number;
  job_parameters?: Record<string, string>;
  pipeline_params?: PipelineParams;
}

interface PowerBITask {
  connection_resource_name: string;
  power_bi_model: PowerBIModel;
  refresh_after_update?: boolean;
  tables?: PowerBITable[];
  warehouse_id: string;
}

interface PowerBIModel {
  authentication_method: "OAUTH" | "PAT";
  model_name: string;
  overwrite_existing: boolean;
  storage_mode: "DIRECT_QUERY" | "IMPORT" | "DUAL";
  workspace_name: string;
}

interface PowerBITable {
  catalog: string;
  name: string;
  schema: string;
  storage_mode: "DIRECT_QUERY" | "IMPORT" | "DUAL";
}

interface CleanRoomsNotebookTask {
  clean_room_name: string;
  etag: string;
  notebook_base_parameters?: Record<string, string>;
  notebook_name: string;
}

// Library definitions
interface Library {
  jar?: string;
  egg?: string; // Deprecated
  whl?: string;
  pypi?: PyPILibrary;
  maven?: MavenLibrary;
  cran?: CranLibrary;
  requirements?: string;
}

interface PyPILibrary {
  package: string;
  repo?: string;
}

interface MavenLibrary {
  coordinates: string;
  repo?: string;
  exclusions?: string[];
}

interface CranLibrary {
  package: string;
  repo?: string;
}

// Cluster specification
export interface ClusterSpec {
  spark_version: string;
  node_type_id?: string;
  autoscale?: AutoscaleConfig;
  num_workers?: number;
  spark_conf?: Record<string, any>;
  aws_attributes?: AWSAttributes;
  custom_tags?: Record<string, string>;
  spark_env_vars?: Record<string, string>;
  enable_elastic_disk?: boolean;
  driver_node_type_id?: string;
  instance_pool_id?: string;
  policy_id?: string;
  driver_instance_pool_id?: string;
  runtime_engine?: string;
  data_security_mode?: string;
}

interface AutoscaleConfig {
  min_workers: number;
  max_workers: number;
}

interface AWSAttributes {
  instance_profile_arn?: string;
  ebs_volume_type?: string;
  ebs_volume_count?: number;
  ebs_volume_size?: number;
  first_on_demand?: number;
  availability?: string;
  spot_bid_price_percent?: number;
  zone_id?: string;
}

// Custom trigger params (domain-specific)
export interface DatabricksJobTriggerParams {
  readonly experimentId: string;
  readonly experimentName: string;
  readonly userId: string;
}
