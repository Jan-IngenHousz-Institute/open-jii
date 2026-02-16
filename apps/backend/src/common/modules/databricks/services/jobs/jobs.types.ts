export enum PerformanceTarget {
  STANDARD = "STANDARD",
  COST_OPTIMIZED = "COST_OPTIMIZED",
  ENHANCED = "ENHANCED",
  PERFORMANCE_OPTIMIZED = "PERFORMANCE_OPTIMIZED",
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
    life_cycle_state:
      | "PENDING"
      | "RUNNING"
      | "TERMINATING"
      | "TERMINATED"
      | "SKIPPED"
      | "INTERNAL_ERROR";
    state_message: string;
    result_state?: "SUCCESS" | "FAILED" | "CANCELED" | "TIMEOUT";
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
