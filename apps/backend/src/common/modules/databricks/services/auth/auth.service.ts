import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosResponse } from "axios";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { Result, AppError, tryCatch, success, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksConfigService } from "../config/config.service";
import { TokenResponse } from "./auth.types";

@Injectable()
export class DatabricksAuthService {
  private readonly logger = new Logger(DatabricksAuthService.name);
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  private static readonly TOKEN_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
  public static readonly TOKEN_ENDPOINT = "/oidc/v1/token";

  constructor(
    private readonly configService: DatabricksConfigService,
    private readonly httpService: HttpService,
  ) {}

  public clearTokenCache(): void {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  public isTokenValid(): boolean {
    return (
      this.accessToken !== null &&
      this.tokenExpiresAt > Date.now() + DatabricksAuthService.TOKEN_BUFFER_MS
    );
  }

  public async getAccessToken(): Promise<Result<string>> {
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
          `Failed to obtain Databricks access token: ${getAxiosErrorMessage(error)}`,
        );
        return apiErrorMapper(error, "Databricks authentication");
      },
    );
  }

  private async requestNewToken(): Promise<Result<TokenResponse>> {
    const tokenUrl = `${this.configService.getHost()}${DatabricksAuthService.TOKEN_ENDPOINT}`;

    return await tryCatch(
      async () => {
        const response: AxiosResponse<TokenResponse> = await this.httpService.axiosRef.post(
          tokenUrl,
          "grant_type=client_credentials&scope=all-apis",
          {
            auth: {
              username: this.configService.getClientId(),
              password: this.configService.getClientSecret(),
            },
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
          },
        );

        const { access_token, token_type, expires_in } = response.data;
        this.validateTokenResponse(access_token, expires_in);

        return { access_token, token_type, expires_in };
      },
      (error) => {
        this.logger.error(`Failed to obtain access token: ${getAxiosErrorMessage(error)}`);
        return apiErrorMapper(`Databricks token request: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  private validateTokenResponse(accessToken: string, expiresIn: number): void {
    if (!accessToken || accessToken.trim() === "") {
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
}
