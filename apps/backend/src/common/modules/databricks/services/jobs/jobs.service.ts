import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosResponse } from "axios";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { ErrorCodes } from "../../../../utils/error-codes";
import {
  Result,
  AppError,
  tryCatch,
  apiErrorMapper,
  failure,
  success,
} from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import {
  DatabricksHealthCheck,
  DatabricksJobRun,
  DatabricksJobRunResponse,
  DatabricksJobRunStatusResponse,
  DatabricksJobsListRequest,
  DatabricksJobsListResponse,
  DatabricksRunNowRequest,
  DatabricksRunsListRequest,
  DatabricksRunsListResponse,
  JobLifecycleState,
  JobResultState,
  PerformanceTarget,
} from "./jobs.types";

@Injectable()
export class DatabricksJobsService {
  private readonly logger = new Logger(DatabricksJobsService.name);

  public static readonly JOBS_ENDPOINT = "/api/2.2/jobs";

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: DatabricksAuthService,
    private readonly configService: DatabricksConfigService,
  ) {}

  async triggerJob(
    jobId: number,
    params: Record<string, string>,
    idempotencyToken?: string,
  ): Promise<Result<DatabricksJobRunResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const result = await this.executeJobTrigger(token, jobId, params, idempotencyToken);
        if (result.isFailure()) {
          throw result.error;
        }

        return result.value;
      },
      (error) => {
        return apiErrorMapper(`Databricks job trigger: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  private async executeJobTrigger(
    token: string,
    jobId: number,
    params: Record<string, string>,
    idempotencyToken?: string,
  ): Promise<Result<DatabricksJobRunResponse>> {
    const host = this.configService.getHost();
    const jobUrl = `${host}${DatabricksJobsService.JOBS_ENDPOINT}/run-now`;

    this.logger.debug(
      `Triggering Databricks job ${jobId} for experiment ${params.experiment_id || params.EXPERIMENT_ID || "unknown"}`,
    );

    const requestBody = this.buildJobTriggerRequest(jobId, params, idempotencyToken);

    return await tryCatch(
      async () => {
        const response: AxiosResponse<DatabricksJobRunResponse> =
          await this.httpService.axiosRef.post(jobUrl, requestBody, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
          });

        const jobRunResponse = response.data;
        this.validateJobRunResponse(jobRunResponse);

        this.logger.log(
          `Successfully triggered Databricks job ${jobId}, run ID: ${jobRunResponse.run_id}`,
        );

        return jobRunResponse;
      },
      (error) => {
        this.logger.error({
          msg: "Error executing job trigger",
          errorCode: ErrorCodes.DATABRICKS_JOB_FAILED,
          operation: "triggerJobInternal",
          error,
        });
        return apiErrorMapper(`Databricks job execution: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  private buildJobTriggerRequest(
    jobId: number,
    params: Record<string, string>,
    idempotencyToken?: string,
  ): DatabricksRunNowRequest {
    const request: DatabricksRunNowRequest = {
      job_id: jobId,
      job_parameters: params,
      queue: {
        enabled: true,
      },
      performance_target: PerformanceTarget.PERFORMANCE_OPTIMIZED,
    };

    if (idempotencyToken) {
      request.idempotency_token = idempotencyToken;
    }

    return request;
  }

  private validateJobRunResponse(response: DatabricksJobRunResponse): void {
    if (!response.run_id) {
      throw AppError.internal("Invalid response from Databricks API: missing run_id");
    }
  }

  async healthCheck(): Promise<Result<DatabricksHealthCheck>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksJobsService.JOBS_ENDPOINT}/list`;

        this.logger.debug({
          msg: "Calling Databricks health check",
          operation: "healthCheck",
          apiUrl,
        });

        const requestParams: DatabricksJobsListRequest = {
          limit: 1,
          expand_tasks: false,
        };

        const response = await this.httpService.axiosRef.get<DatabricksJobsListResponse>(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: requestParams,
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
        });

        const jobsListResponse = response.data;

        return {
          healthy: response.status === 200 && Array.isArray(jobsListResponse.jobs),
          service: "databricks",
        };
      },
      (error) => {
        this.logger.error({
          msg: "Databricks health check failed",
          errorCode: ErrorCodes.DATABRICKS_JOB_FAILED,
          operation: "healthCheck",
          error,
        });
        return apiErrorMapper(`Databricks service unavailable: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  /**
   * Get the status of a job run
   */
  async getJobRunStatus(runId: number): Promise<Result<DatabricksJobRunStatusResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksJobsService.JOBS_ENDPOINT}/runs/get`;

        const response = await this.httpService.axiosRef.get<DatabricksJobRunStatusResponse>(
          apiUrl,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              run_id: runId,
            },
            timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
          },
        );

        return response.data;
      },
      (error) => {
        this.logger.error({
          msg: "Failed to get job run status",
          errorCode: ErrorCodes.DATABRICKS_JOB_FAILED,
          operation: "getJobRunStatus",
          runId,
          error,
        });
        return apiErrorMapper(`Failed to get job run status: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  /**
   * List job runs for a specific job
   * @param jobId - The job ID to list runs for
   * @param activeOnly - If true, only return active (non-terminal) runs
   * @param limit - Maximum number of runs to return (default: 25)
   * @param completedOnly - If true, only return completed (terminal) runs
   */
  async listRunsForJob(
    jobId: number,
    activeOnly = false,
    limit = 25,
    completedOnly = false,
  ): Promise<Result<DatabricksRunsListResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksJobsService.JOBS_ENDPOINT}/runs/list`;

        const requestParams: DatabricksRunsListRequest = {
          job_id: jobId,
          active_only: activeOnly,
          completed_only: completedOnly,
          limit,
          expand_tasks: false,
        };

        const response = await this.httpService.axiosRef.get<DatabricksRunsListResponse>(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: requestParams,
          timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
        });

        return response.data;
      },
      (error) => {
        this.logger.error({
          msg: "Failed to list job runs",
          errorCode: ErrorCodes.DATABRICKS_JOB_FAILED,
          operation: "listRunsForJob",
          jobId,
          error,
        });
        return apiErrorMapper(`Failed to list job runs: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  /**
   * List active runs paired with their job-parameter records and a normalized
   * status. Skips runs whose lifecycle state isn't one of the four we expose.
   */
  async listActiveRunsWithParams(jobId: number): Promise<
    Result<
      {
        run: DatabricksJobRun;
        params: Record<string, string>;
        status: "queued" | "pending" | "running" | "failed";
      }[]
    >
  > {
    const runsResult = await this.listRunsForJob(jobId, true);
    if (runsResult.isFailure()) {
      return failure(runsResult.error);
    }
    return success(
      (runsResult.value.runs ?? []).reduce<
        {
          run: DatabricksJobRun;
          params: Record<string, string>;
          status: "queued" | "pending" | "running" | "failed";
        }[]
      >((acc, run) => {
        const status = this.mapLifecycleToActiveStatus(run.state.life_cycle_state);
        if (!status) {
          return acc;
        }
        acc.push({ run, params: this.jobParamsToRecord(run), status });
        return acc;
      }, []),
    );
  }

  /**
   * List terminated + non-SUCCESS runs paired with their job-parameter records,
   * with `excludeRunIds` filtered out so callers can dedup against the Delta
   * history table.
   */
  async listFailedRunsWithParams(
    jobId: number,
    excludeRunIds: Set<number>,
  ): Promise<Result<{ run: DatabricksJobRun; params: Record<string, string> }[]>> {
    const runsResult = await this.listRunsForJob(jobId, false, 25, true);
    if (runsResult.isFailure()) {
      return failure(runsResult.error);
    }
    return success(
      (runsResult.value.runs ?? []).reduce<
        { run: DatabricksJobRun; params: Record<string, string> }[]
      >((acc, run) => {
        if (excludeRunIds.has(run.run_id)) {
          return acc;
        }
        if (
          run.state.life_cycle_state !== JobLifecycleState.TERMINATED ||
          run.state.result_state === JobResultState.SUCCESS
        ) {
          return acc;
        }
        acc.push({ run, params: this.jobParamsToRecord(run) });
        return acc;
      }, []),
    );
  }

  private jobParamsToRecord(run: DatabricksJobRun): Record<string, string> {
    return (run.job_parameters ?? []).reduce<Record<string, string>>((p, kv) => {
      p[kv.name] = kv.value;
      return p;
    }, {});
  }

  private mapLifecycleToActiveStatus(
    state: JobLifecycleState,
  ): "queued" | "pending" | "running" | "failed" | null {
    switch (state) {
      case JobLifecycleState.QUEUED:
        return "queued";
      case JobLifecycleState.PENDING:
        return "pending";
      case JobLifecycleState.RUNNING:
      case JobLifecycleState.TERMINATING:
        return "running";
      case JobLifecycleState.INTERNAL_ERROR:
        return "failed";
      default:
        return null;
    }
  }
}
