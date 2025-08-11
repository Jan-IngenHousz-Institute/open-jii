export enum PerformanceTarget {
  STANDARD = "STANDARD",
  COST_OPTIMIZED = "COST_OPTIMIZED",
  ENHANCED = "ENHANCED",
}

export interface DatabricksHealthCheck {
  healthy: boolean;
  service: string;
}

export interface DatabricksJobTriggerParams {
  experimentId: string;
  experimentName: string;
  userId: string;
}

export interface DatabricksRunNowRequest {
  job_id: number;
  job_parameters: {
    experiment_id: string;
    experiment_name: string;
  };
  queue: {
    enabled: boolean;
  };
  performance_target: PerformanceTarget;
  idempotency_token: string;
}

export interface DatabricksJobRunResponse {
  run_id: number;
  number_in_job: number;
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
