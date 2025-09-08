export interface DatabricksPipelineGetParams {
  pipelineId: string;
}

export interface DatabricksPipelineListParams {
  maxResults?: number;
  pageToken?: string;
  filter?: string;
}

export interface DatabricksPipelineByNameParams {
  pipelineName: string;
}

export interface DatabricksPipelineStartUpdateParams {
  pipelineId: string;
  // Parameters that can be passed to the update
  fullRefresh?: boolean;
  refreshSelection?: {
    refreshAllData?: boolean;
    datasetNames?: string[];
  };
  parameters?: Record<string, unknown>;
}

export interface DatabricksPipelineSummary {
  pipeline_id: string;
  name: string;
  state: string;
  cluster_id: string;
  health: "HEALTHY" | "UNHEALTHY";
  latest_updates: {
    creation_time: string;
    update_id: string;
    state: string;
  }[];
  run_as_user_name: string;
  creator_user_name: string;
}

export interface DatabricksPipelineListResponse {
  statuses: DatabricksPipelineSummary[];
  next_page_token?: string;
}

export interface DatabricksPipelineResponse {
  pipeline_id: string;
  name: string;
  creator_user_name: string;
  created_time: number; // Timestamp
  last_modified_time: number; // Timestamp
  spec: {
    id: string;
    name: string;
    storage: string;
    configuration?: Record<string, unknown>;
    clusters?: unknown[];
    libraries?: unknown[];
    target?: string;
    continuous?: boolean;
    development?: boolean;
    edition?: string;
    photon?: boolean;
    channel?: string;
  };
  status: {
    maturity_level: string;
    latest_updates?: {
      update_id: string;
      creation_time: number;
      state: string;
      updates_available?: boolean;
    }[];
  };
}

export interface DatabricksPipelineStartUpdateResponse {
  update_id: string;
}
