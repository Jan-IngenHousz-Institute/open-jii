import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { Result, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DeltaConfigService } from "../config/config.service";
import type {
  ListSharesResponse,
  GetShareResponse,
  ListSchemasResponse,
  ListTablesResponse,
} from "./shares.types";

@Injectable()
export class DeltaSharesService {
  private readonly logger = new Logger(DeltaSharesService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DeltaConfigService,
  ) {}

  /**
   * List all shares accessible to the recipient
   */
  async listShares(maxResults?: number, pageToken?: string): Promise<Result<ListSharesResponse>> {
    return await tryCatch(
      async () => {
        const endpoint = this.configService.getEndpoint();
        const url = `${endpoint}/shares`;

        this.logger.debug(`Listing shares from ${url}`);

        const params: Record<string, string> = {};
        if (maxResults !== undefined) {
          params.maxResults = maxResults.toString();
        }
        if (pageToken) {
          params.pageToken = pageToken;
        }

        const response = await this.httpService.axiosRef.get<ListSharesResponse>(url, {
          headers: {
            Authorization: `Bearer ${this.configService.getBearerToken()}`,
          },
          params,
          timeout: this.configService.getRequestTimeout(),
        });

        return response.data;
      },
      (error) => {
        this.logger.error(`Failed to list shares: ${getAxiosErrorMessage(error)}`);
        return apiErrorMapper(error, "Failed to list shares");
      },
    );
  }

  /**
   * Get metadata for a specific share
   */
  async getShare(shareName: string): Promise<Result<GetShareResponse>> {
    return await tryCatch(
      async () => {
        const endpoint = this.configService.getEndpoint();
        const url = `${endpoint}/shares/${encodeURIComponent(shareName)}`;

        this.logger.debug(`Getting share ${shareName} from ${url}`);

        const response = await this.httpService.axiosRef.get<GetShareResponse>(url, {
          headers: {
            Authorization: `Bearer ${this.configService.getBearerToken()}`,
          },
          timeout: this.configService.getRequestTimeout(),
        });

        return response.data;
      },
      (error) => {
        this.logger.error(`Failed to get share ${shareName}: ${getAxiosErrorMessage(error)}`);
        return apiErrorMapper(error, `Failed to get share ${shareName}`);
      },
    );
  }

  /**
   * List schemas in a specific share
   */
  async listSchemas(
    shareName: string,
    maxResults?: number,
    pageToken?: string,
  ): Promise<Result<ListSchemasResponse>> {
    return await tryCatch(
      async () => {
        const endpoint = this.configService.getEndpoint();
        const url = `${endpoint}/shares/${encodeURIComponent(shareName)}/schemas`;

        this.logger.debug(`Listing schemas in share ${shareName} from ${url}`);

        const params: Record<string, string> = {};
        if (maxResults !== undefined) {
          params.maxResults = maxResults.toString();
        }
        if (pageToken) {
          params.pageToken = pageToken;
        }

        const response = await this.httpService.axiosRef.get<ListSchemasResponse>(url, {
          headers: {
            Authorization: `Bearer ${this.configService.getBearerToken()}`,
          },
          params,
          timeout: this.configService.getRequestTimeout(),
        });

        return response.data;
      },
      (error) => {
        this.logger.error(
          `Failed to list schemas in share ${shareName}: ${getAxiosErrorMessage(error)}`,
        );
        return apiErrorMapper(error, `Failed to list schemas in share ${shareName}`);
      },
    );
  }

  /**
   * List tables in a specific schema within a share
   */
  async listTables(
    shareName: string,
    schemaName: string,
    maxResults?: number,
    pageToken?: string,
  ): Promise<Result<ListTablesResponse>> {
    return await tryCatch(
      async () => {
        const endpoint = this.configService.getEndpoint();
        const url = `${endpoint}/shares/${encodeURIComponent(shareName)}/schemas/${encodeURIComponent(schemaName)}/tables`;

        this.logger.debug(`Listing tables in ${shareName}.${schemaName} from ${url}`);

        const params: Record<string, string> = {};
        if (maxResults !== undefined) {
          params.maxResults = maxResults.toString();
        }
        if (pageToken) {
          params.pageToken = pageToken;
        }

        const response = await this.httpService.axiosRef.get<ListTablesResponse>(url, {
          headers: {
            Authorization: `Bearer ${this.configService.getBearerToken()}`,
          },
          params,
          timeout: this.configService.getRequestTimeout(),
        });

        return response.data;
      },
      (error) => {
        this.logger.error(
          `Failed to list tables in ${shareName}.${schemaName}: ${getAxiosErrorMessage(error)}`,
        );
        return apiErrorMapper(error, `Failed to list tables in ${shareName}.${schemaName}`);
      },
    );
  }
}
