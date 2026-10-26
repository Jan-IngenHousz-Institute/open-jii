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
    /** A retried task lists each attempt as its own entry. */
    attempt_number?: number;
    state: {
      life_cycle_state: string;
      result_state?: string;
    };
    notebook_output?: {
      result?: string;
    };
  }[];
}

/** `runs/get-output` for one task run; `error` and `error_trace` are set only when it failed. */
export interface DatabricksJobRunOutputResponse {
  error?: string;
  error_trace?: string;
  notebook_output?: {
    result?: string;
  };
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
