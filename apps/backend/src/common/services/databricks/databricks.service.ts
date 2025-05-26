import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  Result,
  AppError,
  tryCatch,
  apiErrorMapper,
  success,
} from "../../../experiments/utils/fp-utils";
import { DatabricksConfig } from "./databricks.types";
import type {
  DatabricksHealthCheck,
  DatabricksJobRunResponse,
  DatabricksJobTriggerParams,
  DatabricksJobsListRequest,
  DatabricksJobsListResponse,
  DatabricksRunNowRequest,
  TokenResponse,
} from "./databricks.types";

@Injectable()
export class DatabricksService {
  private readonly logger = new Logger(DatabricksService.name);
  private readonly config: DatabricksConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  private static readonly TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly TOKEN_ENDPOINT = "/oidc/v1/token";
  private static readonly JOBS_ENDPOINT = "/api/2.2/jobs";
  private static readonly DEFAULT_REQUEST_TIMEOUT = 30000; // 30 seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): DatabricksConfig {
    return {
      host: this.configService.getOrThrow<string>("databricks.host"),
      clientId: this.configService.getOrThrow<string>("databricks.clientId"),
      clientSecret: this.configService.getOrThrow<string>(
        "databricks.clientSecret",
      ),
      jobId: this.configService.getOrThrow<string>("databricks.jobId"),
    };
  }

  private validateConfig(): void {
    const { host, clientId, clientSecret, jobId } = this.config;

    if (
      !host?.trim() ||
      !clientId?.trim() ||
      !clientSecret?.trim() ||
      !jobId?.trim()
    ) {
      throw new Error(
        "Invalid Databricks configuration: all fields must be non-empty strings",
      );
    }

    try {
      new URL(host);
    } catch {
      throw new Error(`Invalid Databricks host URL: ${host}`);
    }

    if (isNaN(parseInt(jobId, 10))) {
      throw new Error(`Invalid Databricks job ID: ${jobId} must be a number`);
    }
  }

  private getErrorMessage(error: unknown): string {
    if (this.isAxiosError(error)) {
      const message = this.extractAxiosErrorMessage(error);
      return error.response?.status
        ? `HTTP ${error.response.status}: ${message}`
        : message;
    }
    return (error as any) instanceof Error
      ? (error as Error).message
      : String(error);
  }

  private isAxiosError(error: unknown): error is any {
    return (
      typeof error === "object" && error !== null && "isAxiosError" in error
    );
  }

  private extractAxiosErrorMessage(axiosError: any): string {
    return (
      axiosError.response?.data?.message ||
      axiosError.response?.data?.error_description ||
      axiosError.message ||
      "Unknown error"
    );
  }

  private isTokenValid(): boolean {
    return (
      this.accessToken !== null &&
      this.tokenExpiresAt > Date.now() + DatabricksService.TOKEN_BUFFER_MS
    );
  }

  private async getAccessToken(): Promise<Result<string>> {
    if (this.isTokenValid()) {
      return success(this.accessToken!);
    }

    return await tryCatch(
      async () => {
        this.logger.debug("Requesting new Databricks OAuth token");

        const tokenResult = await this.requestNewToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const tokenData = tokenResult.value;
        this.updateTokenCache(tokenData);

        this.logger.debug("Successfully obtained Databricks OAuth token");
        return this.accessToken!;
      },
      (error) => {
        this.logger.error(
          `Failed to obtain Databricks access token: ${this.getErrorMessage(error)}`,
        );
        return apiErrorMapper(error, "Databricks authentication");
      },
    );
  }

  private async requestNewToken(): Promise<Result<TokenResponse>> {
    const tokenUrl = `${this.config.host}${DatabricksService.TOKEN_ENDPOINT}`;

    return await tryCatch(
      async () => {
        const response = await this.httpService.axiosRef.post(
          tokenUrl,
          "grant_type=client_credentials&scope=all-apis",
          {
            auth: {
              username: this.config.clientId,
              password: this.config.clientSecret,
            },
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: DatabricksService.DEFAULT_REQUEST_TIMEOUT,
          },
        );

        const { access_token, token_type, expires_in } = response.data;
        this.validateTokenResponse(access_token, expires_in);

        return { access_token, token_type, expires_in };
      },
      (error) => {
        this.logger.error(
          `Failed to obtain access token: ${this.getErrorMessage(error)}`,
        );
        return apiErrorMapper(error, "Databricks token request");
      },
    );
  }

  private validateTokenResponse(accessToken: string, expiresIn: number): void {
    if (!accessToken?.trim()) {
      throw AppError.internal("Invalid token response: missing access_token");
    }
    if (!expiresIn || expiresIn <= 0) {
      throw AppError.internal("Invalid token response: invalid expires_in");
    }
  }

  private updateTokenCache(tokenData: TokenResponse): void {
    this.accessToken = tokenData.access_token;
    this.tokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
  }

  async triggerJob(
    params: DatabricksJobTriggerParams,
  ): Promise<Result<DatabricksJobRunResponse>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const result = await this.executeJobTrigger(token, params);
        if (result.isFailure()) {
          throw result.error;
        }

        return result.value;
      },
      (error) => {
        this.logger.error(
          `Failed to trigger Databricks job: ${this.getErrorMessage(error)}`,
        );
        return apiErrorMapper(error, "Databricks job trigger");
      },
    );
  }

  private async executeJobTrigger(
    token: string,
    params: DatabricksJobTriggerParams,
  ): Promise<Result<DatabricksJobRunResponse>> {
    const jobUrl = `${this.config.host}${DatabricksService.JOBS_ENDPOINT}/run-now`;

    this.logger.debug(
      `Triggering Databricks job ${this.config.jobId} for experiment ${params.experimentId}`,
    );

    const requestBody = this.buildJobTriggerRequest(params);

    return await tryCatch(
      async () => {
        const response = await this.httpService.axiosRef.post(
          jobUrl,
          requestBody,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: DatabricksService.DEFAULT_REQUEST_TIMEOUT,
          },
        );

        const jobRunResponse: DatabricksJobRunResponse = response.data;
        this.validateJobRunResponse(jobRunResponse);

        this.logger.log(
          `Successfully triggered Databricks job ${this.config.jobId}, run ID: ${jobRunResponse.run_id}`,
        );

        return jobRunResponse;
      },
      (error) => {
        this.logger.error(
          `Error executing job trigger: ${this.getErrorMessage(error)}`,
        );
        return apiErrorMapper(error, "Databricks job execution");
      },
    );
  }

  private buildJobTriggerRequest(
    params: DatabricksJobTriggerParams,
  ): DatabricksRunNowRequest {
    return {
      job_id: parseInt(this.config.jobId, 10),
      notebook_params: {
        experiment_id: params.experimentId,
        experiment_name: params.experimentName,
        user_id: params.userId,
        triggered_at: new Date().toISOString(),
      },
      idempotency_token: params.experimentId,
    };
  }

  private validateJobRunResponse(response: DatabricksJobRunResponse): void {
    if (!response.run_id) {
      throw AppError.internal(
        "Invalid response from Databricks API: missing run_id",
      );
    }
  }

  async healthCheck(): Promise<Result<DatabricksHealthCheck>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        const apiUrl = `${this.config.host}${DatabricksService.JOBS_ENDPOINT}/list`;

        this.logger.debug(`Calling Databricks health check at: ${apiUrl}`);

        const requestParams: DatabricksJobsListRequest = {
          limit: 1, // Minimize response size for health check
          expand_tasks: false,
        };

        const response = await this.httpService.axiosRef.get(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: requestParams,
          timeout: DatabricksService.DEFAULT_REQUEST_TIMEOUT,
        });

        const jobsListResponse = response.data as DatabricksJobsListResponse;

        return {
          healthy:
            response.status === 200 && Array.isArray(jobsListResponse.jobs),
          service: "databricks",
        };
      },
      (error) => {
        this.logger.error(
          `Databricks health check failed: ${this.getErrorMessage(error)}`,
        );
        return apiErrorMapper(error, "Databricks service unavailable");
      },
    );
  }
}
