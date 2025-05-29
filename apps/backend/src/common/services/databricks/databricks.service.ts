import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosError, AxiosResponse, isAxiosError } from "axios";
import z from "zod";

import {
  Result,
  AppError,
  tryCatch,
  apiErrorMapper,
  success,
  failure,
} from "../../utils/fp-utils";
import { DatabricksConfig, PerformanceTarget } from "./databricks.types";
import type {
  DatabricksHealthCheck,
  DatabricksJobRunResponse,
  DatabricksJobTriggerParams,
  DatabricksJobsListRequest,
  DatabricksJobsListResponse,
  DatabricksRunNowRequest,
  TokenResponse,
  ExecuteStatementRequest,
  StatementResponse,
  DatabricksExperimentAnalytics,
} from "./databricks.types";

@Injectable()
export class DatabricksService {
  private readonly logger = new Logger(DatabricksService.name);
  private readonly config: DatabricksConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  private static readonly TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly TOKEN_ENDPOINT = "/oidc/v1/token";
  private static readonly JOBS_ENDPOINT = "/api/2.2/jobs";
  private static readonly SQL_STATEMENTS_ENDPOINT = "/api/2.0/sql/statements";
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
      warehouseId: this.configService.getOrThrow<string>(
        "databricks.warehouseId",
      ),
      catalogName: this.configService.getOrThrow<string>(
        "databricks.catalogName",
      ),
    };
  }

  private validateConfig(): void {
    const databricksConfigSchema = z.object({
      host: z.string().url(),
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      jobId: z
        .string()
        .min(1)
        .refine((val) => !isNaN(Number(val)), {
          message: "Job ID must be numeric",
        }),
      warehouseId: z.string().min(1),
      catalogName: z.string().min(1),
    });

    try {
      databricksConfigSchema.parse(this.config);
    } catch {
      throw new Error(
        "Invalid Databricks configuration: all fields must be non-empty strings",
      );
    }
  }

  private getErrorMessage(error: unknown): string {
    if (
      isAxiosError<
        { message?: string; error_description?: string } | undefined
      >(error)
    ) {
      const message = this.extractAxiosErrorMessage(error);
      return error.response?.status
        ? `HTTP ${error.response.status}: ${message}`
        : message;
    }
    return (error as any) instanceof Error
      ? (error as Error).message
      : String(error);
  }

  private extractAxiosErrorMessage(
    axiosError: AxiosError<
      { message?: string; error_description?: string } | undefined
    >,
  ): string {
    return (
      axiosError.response?.data?.message ??
      axiosError.response?.data?.error_description ??
      (axiosError.message || "Unknown error")
    );
  }

  private isTokenValid(): boolean {
    return (
      this.accessToken !== null &&
      this.tokenExpiresAt > Date.now() + DatabricksService.TOKEN_BUFFER_MS
    );
  }

  private async getAccessToken(): Promise<Result<string>> {
    if (this.isTokenValid() && this.accessToken) {
      return success(this.accessToken);
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

        if (!this.accessToken) {
          throw AppError.internal("Failed to obtain Databricks access token");
        }

        this.logger.debug("Successfully obtained Databricks OAuth token");
        return this.accessToken;
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
        const response: AxiosResponse<TokenResponse> =
          await this.httpService.axiosRef.post(
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
    if (!accessToken.trim()) {
      throw AppError.internal("Invalid token response: missing access_token");
    }
    if (!expiresIn || expiresIn <= 0) {
      throw AppError.internal("Invalid token response: invalid expires_in");
    }
  }

  private updateTokenCache(tokenData: TokenResponse) {
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
        const response: AxiosResponse<DatabricksJobRunResponse> =
          await this.httpService.axiosRef.post(jobUrl, requestBody, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: DatabricksService.DEFAULT_REQUEST_TIMEOUT,
          });

        const jobRunResponse = response.data;
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
      job_parameters: {
        experiment_id: params.experimentId,
        experiment_name: params.experimentName,
      },
      queue: {
        enabled: true,
      },
      performance_target: PerformanceTarget.STANDARD,
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

  async getExperimentData(
    experimentId: string,
    experimentName: string,
  ): Promise<Result<DatabricksExperimentAnalytics>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;

        const schemaName = `exp_${experimentName}_${experimentId}`;

        // Execute SQL query to get experiment data
        const queryResult = await this.executeSqlStatement(
          token,
          schemaName,
          `SELECT * FROM bronze_data_exp`,
        );

        if (queryResult.isFailure()) {
          throw queryResult.error;
        }

        // Format the response
        const response = this.formatExperimentAnalyticsResponse(
          queryResult.value,
        );
        return response;
      },
      (error) => {
        this.logger.error(
          `Failed to get experiment data from Databricks: ${this.getErrorMessage(error)}`,
        );
        return apiErrorMapper(error, "Databricks SQL query execution");
      },
    );
  }

  private async executeSqlStatement(
    token: string,
    schemaName: string,
    sqlStatement: string,
  ): Promise<Result<StatementResponse>> {
    const statementUrl = `${this.config.host}${DatabricksService.SQL_STATEMENTS_ENDPOINT}/`;

    this.logger.debug(`Executing SQL statement in Databricks: ${sqlStatement}`);

    const requestBody: ExecuteStatementRequest = {
      statement: sqlStatement,
      warehouse_id: this.config.warehouseId,
      schema: schemaName,
      catalog: this.config.catalogName,
      wait_timeout: "50s", // Maximum supported wait time
      disposition: "INLINE", // We want the data inline with the response
      format: "JSON_ARRAY",
    };

    try {
      const response: AxiosResponse<StatementResponse> =
        await this.httpService.axiosRef.post(statementUrl, requestBody, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 60000, // Longer timeout for SQL queries
        });

      const statementResponse = response.data;

      // Check if the statement is in a terminal state
      if (statementResponse.status.state === "SUCCEEDED") {
        return success(statementResponse);
      } else if (
        ["FAILED", "CANCELED", "CLOSED"].includes(
          statementResponse.status.state,
        )
      ) {
        if (statementResponse.status.error) {
          return failure(
            AppError.internal(
              `SQL statement execution failed: ${statementResponse.status.error.message ?? "Unknown error"}`,
            ),
          );
        }
        return failure(
          AppError.internal(
            `SQL statement execution ${statementResponse.status.state.toLowerCase()}`,
          ),
        );
      }

      // For PENDING or RUNNING states, poll until completion
      return await this.pollStatementExecution(
        token,
        statementResponse.statement_id,
      );
    } catch (error) {
      this.logger.error(
        `Error executing SQL statement: ${this.getErrorMessage(error)}`,
      );
      return failure(
        AppError.internal(
          `Databricks SQL statement execution failed: ${this.getErrorMessage(error)}`,
        ),
      );
    }
  }

  private async pollStatementExecution(
    token: string,
    statementId: string,
  ): Promise<Result<StatementResponse>> {
    const maxAttempts = 30; // Maximum polling attempts
    const pollingIntervalMs = 1000; // 1 second between polls

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const getUrl = `${this.config.host}${DatabricksService.SQL_STATEMENTS_ENDPOINT}/${statementId}`;

      try {
        const response: AxiosResponse<StatementResponse> =
          await this.httpService.axiosRef.get(getUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: DatabricksService.DEFAULT_REQUEST_TIMEOUT,
          });

        const statementResponse = response.data;

        // Check if the statement finished
        if (statementResponse.status.state === "SUCCEEDED") {
          return success(statementResponse);
        } else if (
          ["FAILED", "CANCELED", "CLOSED"].includes(
            statementResponse.status.state,
          )
        ) {
          if (statementResponse.status.error) {
            return failure(
              AppError.internal(
                `SQL statement execution failed: ${statementResponse.status.error.message ?? "Unknown error"}`,
              ),
            );
          }
          return failure(
            AppError.internal(
              `SQL statement execution ${statementResponse.status.state.toLowerCase()}`,
            ),
          );
        }

        // Still running or pending, wait and retry
        await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
      } catch (error) {
        this.logger.error(
          `Error polling SQL statement execution: ${this.getErrorMessage(error)}`,
        );
        return failure(
          AppError.internal(
            `Databricks SQL polling failed: ${this.getErrorMessage(error)}`,
          ),
        );
      }
    }

    // If we've exhausted our polling attempts, return a timeout error
    return failure(
      AppError.internal(
        "SQL statement execution timed out after multiple polling attempts",
      ),
    );
  }

  private formatExperimentAnalyticsResponse(
    response: StatementResponse,
  ): DatabricksExperimentAnalytics {
    if (!response.manifest || !response.result) {
      throw AppError.internal(
        "Invalid SQL statement response: missing manifest or result data",
      );
    }

    const columns = response.manifest.schema.columns.map((column) => ({
      name: column.name,
      type_name: column.type_name,
      type_text: column.type_text,
    }));

    return {
      columns,
      rows: response.result.data_array,
      totalRows: response.manifest.total_row_count ?? response.result.row_count,
      truncated: response.manifest.truncated ?? false,
    };
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
