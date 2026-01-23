import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosResponse } from "axios";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { ErrorCodes } from "../../../../utils/error-codes";
import { Result, AppError, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import {
  DatabricksHealthCheck,
  DatabricksJobRunResponse,
  DatabricksJobsListRequest,
  DatabricksJobsListResponse,
  DatabricksRunNowRequest,
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
        this.logger.error({
          msg: "Failed to trigger Databricks job",
          errorCode: ErrorCodes.DATABRICKS_JOB_FAILED,
          operation: "triggerJob",
          error,
        });
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
      performance_target: PerformanceTarget.STANDARD,
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
}
