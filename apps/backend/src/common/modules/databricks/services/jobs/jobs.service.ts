import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosResponse } from "axios";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { ErrorCodes } from "../../../../utils/error-codes";
import { Result, AppError, tryCatch, apiErrorMapper, success } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import {
  DatabricksHealthCheck,
  DatabricksJobRunResponse,
  DatabricksJobRunOutputResponse,
  DatabricksJobRunStatusResponse,
  DatabricksJobSummary,
  DatabricksJobsListRequest,
  DatabricksJobsListResponse,
  DatabricksRunNowRequest,
  PerformanceTarget,
} from "./jobs.types";

@Injectable()
export class DatabricksJobsService {
  private readonly logger = new Logger(DatabricksJobsService.name);
  private readonly jobIdsByName = new Map<string, number>();

  public static readonly JOBS_ENDPOINT = "/api/2.2/jobs";

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: DatabricksAuthService,
    private readonly configService: DatabricksConfigService,
  ) {}

  // A job keeps its id for life, so a resolved name is cached for the process lifetime;
  // failures are never cached.
  async getJobIdByName(name: string): Promise<Result<number>> {
    const cachedJobId = this.jobIdsByName.get(name);
    if (cachedJobId !== undefined) {
      return success(cachedJobId);
    }

    const result = await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const host = this.configService.getHost();
        const requestParams: DatabricksJobsListRequest = {
          name,
          // Two are enough to tell a unique name from a duplicate.
          limit: 2,
          expand_tasks: false,
        };

        const response = await this.httpService.axiosRef.get<DatabricksJobsListResponse>(
          `${host}${DatabricksJobsService.JOBS_ENDPOINT}/list`,
          {
            headers: {
              Authorization: `Bearer ${tokenResult.value}`,
            },
            params: requestParams,
            timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
          },
        );

        return this.singleJobId(name, response.data.jobs ?? []);
      },
      (error) => {
        this.logger.error({
          msg: "Failed to find Databricks job by name",
          errorCode: ErrorCodes.DATABRICKS_JOB_FAILED,
          operation: "getJobIdByName",
          jobName: name,
          error,
        });
        return apiErrorMapper(error, "Databricks job lookup");
      },
    );

    if (result.isSuccess()) {
      this.jobIdsByName.set(name, result.value);
    }

    return result;
  }

  private singleJobId(name: string, jobs: DatabricksJobSummary[]): number {
    if (jobs.length === 0) {
      throw AppError.notFound(
        `No Databricks job is named ${name}`,
        ErrorCodes.DATABRICKS_JOB_FAILED,
      );
    }

    if (jobs.length > 1) {
      throw AppError.internal(
        `More than one Databricks job is named ${name}`,
        ErrorCodes.DATABRICKS_JOB_FAILED,
      );
    }

    return jobs[0].job_id;
  }

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
   * Get the output of one task run, which is where a failed notebook's error lives
   */
  async getJobRunOutput(taskRunId: number): Promise<Result<DatabricksJobRunOutputResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const host = this.configService.getHost();
        const apiUrl = `${host}${DatabricksJobsService.JOBS_ENDPOINT}/runs/get-output`;

        const response = await this.httpService.axiosRef.get<DatabricksJobRunOutputResponse>(
          apiUrl,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              run_id: taskRunId,
            },
            timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
          },
        );

        return response.data;
      },
      (error) => {
        this.logger.error({
          msg: "Failed to get job run output",
          errorCode: ErrorCodes.DATABRICKS_JOB_FAILED,
          operation: "getJobRunOutput",
          taskRunId,
          error,
        });
        return apiErrorMapper(`Failed to get job run output: ${getAxiosErrorMessage(error)}`);
      },
    );
  }
}
