import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosError } from "axios";
import { catchError, firstValueFrom, throwError } from "rxjs";

import {
  Result,
  success,
  failure,
  AppError,
} from "../../experiments/utils/fp-utils";

export interface DatabricksConfig {
  readonly host: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly jobId: string;
}

export interface DatabricksJobRunResponse {
  run_id: number;
  number_in_job: number;
}

export interface DatabricksJobTriggerParams {
  readonly experimentId: string;
  readonly experimentName: string;
  readonly userId: string;
}

export interface DatabricksHealthCheck {
  readonly healthy: boolean;
  readonly service: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class DatabricksService {
  private readonly logger = new Logger(DatabricksService.name);
  private readonly config: DatabricksConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  private static readonly TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.config = this.loadConfig();
    this.validateConfig();
  }

  private loadConfig(): DatabricksConfig {
    return {
      host: this.configService.get<string>("databricks.host", ""),
      clientId: this.configService.get<string>("databricks.clientId", ""),
      clientSecret: this.configService.get<string>(
        "databricks.clientSecret",
        "",
      ),
      jobId: this.configService.get<string>("databricks.jobId", ""),
    };
  }

  private validateConfig(): void {
    const required: (keyof DatabricksConfig)[] = [
      "host",
      "clientId",
      "clientSecret",
      "jobId",
    ];
    const missing = required.filter((key) => !this.config[key]);

    if (missing.length > 0) {
      this.logger.error(
        `Missing Databricks configuration: ${missing.join(", ")}`,
      );
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === "object" && "isAxiosError" in error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message =
        (axiosError.response?.data as any)?.message ||
        (axiosError.response?.data as any)?.error_description ||
        axiosError.message;
      return `HTTP ${status}: ${message}`;
    }
    return error instanceof Error ? error.message : String(error);
  }

  private isTokenValid(): boolean {
    return (
      this.accessToken !== null &&
      this.tokenExpiresAt > Date.now() + DatabricksService.TOKEN_BUFFER_MS
    );
  }

  private async getAccessToken(): Promise<Result<string>> {
    try {
      if (this.isTokenValid()) {
        return success(this.accessToken!);
      }

      this.logger.debug("Requesting new Databricks OAuth token");

      const tokenResult = await this.requestNewToken();
      if (tokenResult.isFailure()) {
        return failure((tokenResult as any).error);
      }

      const tokenData = (tokenResult as any).value as TokenResponse;
      this.updateTokenCache(tokenData);

      this.logger.debug("Successfully obtained Databricks OAuth token");
      return success(this.accessToken!);
    } catch (error) {
      this.logger.error(
        `Failed to obtain Databricks access token: ${this.getErrorMessage(error)}`,
      );
      return this.handleTokenError(error);
    }
  }
  private async requestNewToken(): Promise<Result<TokenResponse>> {
    const tokenUrl = `${this.config.host}/oidc/v1/token`;

    try {
      const response$ = this.httpService.post(
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
        },
      );

      const response = await firstValueFrom(
        response$.pipe(catchError((error) => throwError(() => error))),
      );

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        return failure(
          AppError.internal("Failed to obtain Databricks access token"),
        );
      }

      return success({ access_token, expires_in });
    } catch (error) {
      throw error;
    }
  }

  private updateTokenCache(tokenData: TokenResponse): void {
    this.accessToken = tokenData.access_token;
    this.tokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
  }

  private handleTokenError(error: unknown): Result<string> {
    if (error && typeof error === "object" && "isAxiosError" in error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message =
        (axiosError.response?.data as any)?.error_description ||
        axiosError.message;

      if (status === 401) {
        return failure(
          AppError.unauthorized(`Databricks authentication failed: ${message}`),
        );
      }

      return failure(
        AppError.internal(`Databricks token request failed: ${message}`),
      );
    }

    return failure(
      AppError.internal("Unexpected error during Databricks authentication"),
    );
  }

  async triggerJob(
    params: DatabricksJobTriggerParams,
  ): Promise<Result<DatabricksJobRunResponse>> {
    try {
      if (!this.config.jobId) {
        return failure(AppError.internal("Databricks job ID not configured"));
      }

      const tokenResult = await this.getAccessToken();
      if (tokenResult.isFailure()) {
        return failure((tokenResult as any).error);
      }

      const token = (tokenResult as any).value;
      return await this.executeJobTrigger(token, params);
    } catch (error) {
      this.logger.error(
        `Failed to trigger Databricks job: ${this.getErrorMessage(error)}`,
      );
      return this.handleJobTriggerError(error);
    }
  }

  private async executeJobTrigger(
    token: string,
    params: DatabricksJobTriggerParams,
  ): Promise<Result<DatabricksJobRunResponse>> {
    const jobUrl = `${this.config.host}/api/2.2/jobs/run-now`;

    this.logger.debug(
      `Triggering Databricks job ${this.config.jobId} for experiment ${params.experimentId}`,
    );

    const requestBody = {
      job_id: parseInt(this.config.jobId, 10),
      notebook_params: {
        experiment_id: params.experimentId,
        experiment_name: params.experimentName,
        user_id: params.userId,
        triggered_at: new Date().toISOString(),
      },
    };

    try {
      const response$ = this.httpService.post(jobUrl, requestBody, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const response = await firstValueFrom(
        response$.pipe(catchError((error) => throwError(() => error))),
      );

      const jobRunResponse: DatabricksJobRunResponse = response.data;

      this.logger.log(
        `Successfully triggered Databricks job ${this.config.jobId}, run ID: ${jobRunResponse.run_id}`,
      );

      return success(jobRunResponse);
    } catch (error) {
      throw error;
    }
  }
  private handleJobTriggerError(
    error: unknown,
  ): Result<DatabricksJobRunResponse> {
    if (error && typeof error === "object" && "isAxiosError" in error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message =
        (axiosError.response?.data as any)?.message || axiosError.message;

      switch (status) {
        case 400:
          return failure(
            AppError.badRequest(`Invalid Databricks job request: ${message}`),
          );
        case 401:
          return failure(
            AppError.unauthorized(
              `Databricks authentication failed: ${message}`,
            ),
          );
        case 404:
          return failure(
            AppError.badRequest(`Databricks job not found: ${message}`),
          );
        default:
          return failure(
            AppError.internal(`Databricks job trigger failed: ${message}`),
          );
      }
    }

    return failure(
      AppError.internal("Unexpected error during Databricks job trigger"),
    );
  }

  async healthCheck(): Promise<Result<DatabricksHealthCheck>> {
    try {
      const tokenResult = await this.getAccessToken();
      if (tokenResult.isFailure()) {
        return failure((tokenResult as any).error);
      }

      const token = (tokenResult as any).value;
      const apiUrl = `${this.config.host}/api/2.2/jobs/list`;
      this.logger.debug(`Calling Databricks health check at: ${apiUrl}`);

      const response$ = this.httpService.get(apiUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          limit: 10,
        },
      });

      const response = await firstValueFrom(
        response$.pipe(catchError((error) => throwError(() => error))),
      );

      return success({
        healthy: response.status === 200,
        service: "databricks",
      });
    } catch (error) {
      this.logger.error(
        `Databricks health check failed: ${this.getErrorMessage(error)}`,
      );
      return failure(AppError.internal("Databricks service unavailable"));
    }
  }
}
