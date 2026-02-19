export enum PerformanceTarget {
  STANDARD = "STANDARD",
  COST_OPTIMIZED = "COST_OPTIMIZED",
  ENHANCED = "ENHANCED",
  PERFORMANCE_OPTIMIZED = "PERFORMANCE_OPTIMIZED",
}

export enum JobLifecycleState {
  QUEUED = "QUEUED",
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  TERMINATING = "TERMINATING",
  TERMINATED = "TERMINATED",
  SKIPPED = "SKIPPED",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  BLOCKED = "BLOCKED",
  WAITING_FOR_RETRY = "WAITING_FOR_RETRY",
}

export enum JobResultState {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELED = "CANCELED",
  TIMEOUT = "TIMEOUT",
}

export interface DatabricksHealthCheck {
  healthy: boolean;
  service: string;
}

export interface DatabricksRunNowRequest {
  job_id: number;
  job_parameters: Record<string, string>;
  queue: {
    enabled: boolean;
  };
  performance_target: PerformanceTarget;
  idempotency_token?: string;
}

export interface DatabricksJobRunResponse {
  run_id: number;
  number_in_job: number;
}

export interface DatabricksJobRunStatusResponse {
  run_id: number;
  state: {
    life_cycle_state: JobLifecycleState;
    state_message: string;
    result_state?: JobResultState;
  };
  tasks?: {
    run_id: number;
    task_key: string;
    state: {
      life_cycle_state: string;
      result_state?: string;
    };
    notebook_output?: {
      result?: string;
    };
  }[];
}

export interface DatabricksJobsListRequest {
  limit: number;
  expand_tasks: boolean;
}

export interface DatabricksJobsListResponse {
  jobs: {
    job_id: number;
    settings: {
      name: string;
    };
  }[];
}

export interface DatabricksRunsListRequest {
  job_id?: number;
  active_only?: boolean;
  completed_only?: boolean;
  offset?: number;
  limit?: number;
  expand_tasks?: boolean;
}

export interface DatabricksJobRun {
  run_id: number;
  job_id: number;
  number_in_job: number;
  state: {
    life_cycle_state: JobLifecycleState;
    state_message?: string;
    result_state?: JobResultState;
  };
  start_time: number; // Epoch milliseconds - set when run starts (cluster creation call)
  end_time?: number; // Optional - set to 0 if job is still running
  job_parameters?: {
    name: string;
    value: string;
    default?: string;
  }[];
}

export interface DatabricksRunsListResponse {
  runs?: DatabricksJobRun[]; // Optional - only included if there are runs to list
  has_more: boolean;
  next_page_token?: string;
  prev_page_token?: string;
}
