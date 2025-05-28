export interface DatabricksConfig {
  readonly host: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly jobId: string;
}

// Based on Databricks API documentation for Jobs Run Now
// https://docs.databricks.com/api/workspace/jobs/runnow
export interface DatabricksRunNowRequest {
  job_id: number;
  idempotency_token?: string;
  job_parameters?: Record<string, string>;
  only?: string[];
  performance_target?: "PERFORMANCE_OPTIMIZED" | "STANDARD";
  pipeline_params?: {
    full_refresh?: boolean;
    [key: string]: any;
  };
  queue?: {
    enabled: boolean;
  };
  // Legacy parameters for backward compatibility
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
  life_cycle_state: string;
  result_state?: string;
  state_message?: string;
}

export interface DatabricksJobTriggerParams {
  readonly experimentId: string;
  readonly experimentName: string;
  readonly userId: string;
}

// Based on Databricks API documentation for Jobs List
// https://docs.databricks.com/api/workspace/jobs/list
export interface DatabricksJobsListRequest {
  limit?: number; // Default 20, max 100
  expand_tasks?: boolean; // Default false
  name?: string; // Filter by exact job name (case insensitive)
  page_token?: string; // For pagination
}

export interface DatabricksJobsListResponse {
  jobs?: DatabricksJob[]; // Only included if there are jobs to list
  next_page_token?: string; // A token that can be used to list the next page of jobs (if applicable)
  prev_page_token?: string; // A token that can be used to list the previous page of jobs (if applicable)
}

export interface DatabricksJob {
  job_id: number;
  creator_user_name?: string; // This field won't be included if the user has been deleted
  created_time: number; // Epoch milliseconds
  settings: DatabricksJobSettings;
  has_more?: boolean; // Indicates if job has more properties not shown
  effective_budget_policy_id?: string; // UUID for cost attribution
}

export interface DatabricksJobSettings {
  name: string;
  tasks?: JobTask[];
  format?: string; // SINGLE_TASK, MULTI_TASK
  description?: string;
  email_notifications?: {
    on_start?: string[];
    on_success?: string[];
    on_failure?: string[];
    on_duration_warning_threshold_exceeded?: string[];
    no_alert_for_skipped_runs?: boolean;
    on_streaming_backlog_exceeded?: string[];
  };
  webhook_notifications?: {
    on_start?: Array<Array<{ id: string }>>;
    on_success?: Array<Array<{ id: string }>>;
    on_failure?: Array<Array<{ id: string }>>;
    on_duration_warning_threshold_exceeded?: Array<Array<{ id: string }>>;
    on_streaming_backlog_exceeded?: Array<Array<{ id: string }>>;
  };
  notification_settings?: {
    no_alert_for_skipped_runs?: boolean;
    no_alert_for_canceled_runs?: boolean;
  };
  timeout_seconds?: number;
  max_concurrent_runs?: number;
  job_clusters?: Array<{
    job_cluster_key: string;
    new_cluster: ClusterSpec;
  }>;
  run_as?: {
    user_name?: string;
    service_principal_name?: string;
  };
  schedule?: {
    quartz_cron_expression: string;
    timezone_id: string;
    pause_status?: "PAUSED" | "UNPAUSED";
  };
  continuous?: {
    pause_status: "PAUSED" | "UNPAUSED";
  };
  trigger?: {
    pause_status?: "PAUSED" | "UNPAUSED";
    file_arrival?: {
      url: string;
      min_time_between_triggers_seconds?: number;
      wait_after_last_change_seconds?: number;
    };
    periodic?: {
      interval: number;
      unit: "MINUTES" | "HOURS" | "DAYS";
    };
  };
  git_source?: {
    git_url: string;
    git_provider: string;
    git_branch?: string;
    git_commit?: string;
    git_tag?: string;
    git_snapshot?: {
      used_commit: string;
    };
  };
  health?: {
    rules: Array<{
      metric:
        | "RUN_DURATION_SECONDS"
        | "STREAMING_BACKLOG_BYTES"
        | "STREAMING_BACKLOG_RECORDS"
        | "STREAMING_BACKLOG_SECONDS"
        | "STREAMING_BACKLOG_FILES";
      op: "GREATER_THAN";
      value: number;
    }>;
  };
  parameters?: Array<{
    name: string;
    default?: string;
  }>;
  tags?: Record<string, string>;
  performance_target?: "PERFORMANCE_OPTIMIZED" | "STANDARD";
  budget_policy_id?: string;
  queue?: {
    enabled: boolean;
  };
  edit_mode?: "UI_LOCKED" | "EDITABLE";
  deployment?: {
    kind: "BUNDLE";
    metadata_file_path?: string;
  };
  environments?: Array<{
    environment_key: string;
    spec: {
      client: string;
      dependencies: string[];
      [key: string]: any;
    };
  }>;
}

export interface JobTask {
  task_key: string;
  description?: string;
  depends_on?: Array<{
    task_key: string;
    outcome?: string; // Used for condition task dependencies
  }>;
  existing_cluster_id?: string;
  new_cluster?: ClusterSpec;
  job_cluster_key?: string;
  environment_key?: string; // Used for serverless compute tasks
  disable_auto_optimization?: boolean;
  notebook_task?: {
    notebook_path: string;
    base_parameters?: Record<string, string>;
    source?: "WORKSPACE" | "GIT";
    warehouse_id?: string; // For running on SQL warehouse
  };
  spark_jar_task?: {
    main_class_name: string;
    parameters?: string[];
    jar_uri?: string; // Deprecated, use libraries instead
    run_as_repl?: boolean; // Deprecated
  };
  spark_python_task?: {
    python_file: string;
    parameters?: string[];
    source?: "WORKSPACE" | "GIT";
  };
  spark_submit_task?: {
    parameters?: string[];
  };
  python_wheel_task?: {
    package_name: string;
    entry_point?: string;
    parameters?: string[];
    named_parameters?: Record<string, string>;
  };
  shell_command_task?: {
    command: string;
  };
  pipeline_task?: {
    pipeline_id: string;
    full_refresh?: boolean; // Default is false
  };
  sql_task?: {
    query?: {
      query_id?: string;
    };
    dashboard?: {
      dashboard_id?: string;
      custom_subject?: string;
      pause_subscriptions?: boolean;
      subscriptions?: any[];
    };
    alert?: {
      alert_id?: string;
      pause_subscriptions?: boolean;
      subscriptions?: any[];
    };
    file?: {
      path: string;
      source?: "WORKSPACE" | "GIT";
    };
    parameters?: Record<string, string>;
    warehouse_id?: string;
  };
  dbt_task?: {
    project_directory: string;
    commands?: string[];
    catalog?: string;
    schema?: string;
    warehouse_id?: string;
    profiles_directory?: string;
    profile?: string;
    target?: string;
    flags?: string;
    source?: "WORKSPACE" | "GIT";
  };
  condition_task?: {
    left: string;
    op:
      | "EQUAL_TO"
      | "GREATER_THAN"
      | "GREATER_THAN_OR_EQUAL"
      | "LESS_THAN"
      | "LESS_THAN_OR_EQUAL"
      | "NOT_EQUAL";
    right: string;
  };
  for_each_task?: {
    concurrency?: number;
    inputs: string; // JSON string or reference to array parameter
    task: any; // Nested task to execute
  };
  run_job_task?: {
    job_id: number;
    job_parameters?: Record<string, string>;
    pipeline_params?: {
      full_refresh?: boolean;
    };
  };
  power_bi_task?: {
    connection_resource_name: string;
    power_bi_model: {
      authentication_method: "OAUTH" | "PAT";
      model_name: string;
      overwrite_existing: boolean;
      storage_mode: "DIRECT_QUERY" | "IMPORT" | "DUAL";
      workspace_name: string;
    };
    refresh_after_update?: boolean;
    tables?: Array<{
      catalog: string;
      name: string;
      schema: string;
      storage_mode: "DIRECT_QUERY" | "IMPORT" | "DUAL";
    }>;
    warehouse_id: string;
  };
  clean_rooms_notebook_task?: {
    clean_room_name: string;
    etag: string;
    notebook_base_parameters?: Record<string, string>;
    notebook_name: string;
  };
  // Tasks configuration
  timeout_seconds?: number;
  max_retries?: number;
  min_retry_interval_millis?: number;
  retry_on_timeout?: boolean;
  run_if?:
    | "ALL_SUCCESS"
    | "AT_LEAST_ONE_SUCCESS"
    | "NONE_FAILED"
    | "ALWAYS"
    | "ALL_FAILED"
    | "AT_LEAST_ONE_FAILED";
  libraries?: Array<{
    jar?: string;
    egg?: string; // Deprecated in DBR 14.0+
    whl?: string;
    pypi?: {
      package: string;
      repo?: string;
    };
    maven?: {
      coordinates: string;
      repo?: string;
      exclusions?: string[];
    };
    cran?: {
      package: string;
      repo?: string;
    };
    requirements?: string;
  }>;
  // Notifications
  email_notifications?: {
    on_start?: string[];
    on_success?: string[];
    on_failure?: string[];
    on_duration_warning_threshold_exceeded?: string[];
    no_alert_for_skipped_runs?: boolean;
    on_streaming_backlog_exceeded?: string[];
  };
  webhook_notifications?: {
    on_start?: Array<{ id: string }[]>;
    on_success?: Array<{ id: string }[]>;
    on_failure?: Array<{ id: string }[]>;
    on_duration_warning_threshold_exceeded?: Array<{ id: string }[]>;
    on_streaming_backlog_exceeded?: Array<{ id: string }[]>;
  };
  notification_settings?: {
    no_alert_for_skipped_runs?: boolean;
    no_alert_for_canceled_runs?: boolean;
    alert_on_last_attempt?: boolean;
  };
  // Health monitoring
  health?: {
    rules: Array<{
      metric:
        | "RUN_DURATION_SECONDS"
        | "STREAMING_BACKLOG_BYTES"
        | "STREAMING_BACKLOG_RECORDS"
        | "STREAMING_BACKLOG_SECONDS"
        | "STREAMING_BACKLOG_FILES";
      op: "GREATER_THAN";
      value: number;
    }>;
  };
}

export interface DatabricksHealthCheck {
  readonly healthy: boolean;
  readonly service: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface ClusterSpec {
  spark_version: string;
  node_type_id?: string;
  autoscale?: {
    min_workers: number;
    max_workers: number;
  };
  num_workers?: number;
  spark_conf?: Record<string, any>;
  aws_attributes?: {
    instance_profile_arn?: string;
    ebs_volume_type?: string;
    ebs_volume_count?: number;
    ebs_volume_size?: number;
    first_on_demand?: number;
    availability?: string;
    spot_bid_price_percent?: number;
    zone_id?: string;
  };
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
