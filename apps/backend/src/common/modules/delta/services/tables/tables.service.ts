import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { Result, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DeltaConfigService } from "../config/config.service";
import type {
  TableQueryRequest,
  TableMetadataResponse,
  TableQueryResponse,
  DeltaResponseLine,
  ProtocolLine,
  MetadataLine,
} from "../shares/shares.types";

@Injectable()
export class DeltaTablesService {
  private readonly logger = new Logger(DeltaTablesService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DeltaConfigService,
  ) {}

  /**
   * Get table metadata including schema information
   */
  async getTableMetadata(
    shareName: string,
    schemaName: string,
    tableName: string,
  ): Promise<Result<TableMetadataResponse>> {
    return await tryCatch(
      async () => {
        const endpoint = this.configService.getEndpoint();
        const url = `${endpoint}/shares/${encodeURIComponent(shareName)}/schemas/${encodeURIComponent(schemaName)}/tables/${encodeURIComponent(tableName)}/metadata`;

        this.logger.debug(`Getting table metadata for ${shareName}.${schemaName}.${tableName}`);

        const response = await this.httpService.axiosRef.get(url, {
          headers: {
            Authorization: `Bearer ${this.configService.getBearerToken()}`,
            Accept: "application/x-ndjson; charset=utf-8",
          },
          timeout: this.configService.getRequestTimeout(),
          responseType: "text",
        });

        const deltaTableVersion = response.headers["delta-table-version"] as string | undefined;
        const version = deltaTableVersion ? parseInt(deltaTableVersion, 10) : 0;

        return this.parseMetadataResponse(response.data as string, version);
      },
      (error) => {
        this.logger.error(
          `Failed to get table metadata for ${shareName}.${schemaName}.${tableName}: ${getAxiosErrorMessage(error)}`,
        );
        return apiErrorMapper(
          error,
          `Failed to get table metadata for ${shareName}.${schemaName}.${tableName}`,
        );
      },
    );
  }

  /**
   * Query table data with optional filtering and pagination hints
   */
  async queryTable(
    shareName: string,
    schemaName: string,
    tableName: string,
    queryRequest: TableQueryRequest = {},
  ): Promise<Result<TableQueryResponse>> {
    return await tryCatch(
      async () => {
        const endpoint = this.configService.getEndpoint();
        const url = `${endpoint}/shares/${encodeURIComponent(shareName)}/schemas/${encodeURIComponent(schemaName)}/tables/${encodeURIComponent(tableName)}/query`;

        this.logger.debug(
          `Querying table ${shareName}.${schemaName}.${tableName} with request: ${JSON.stringify(queryRequest)}`,
        );

        const response = await this.httpService.axiosRef.post(url, queryRequest, {
          headers: {
            Authorization: `Bearer ${this.configService.getBearerToken()}`,
            "Content-Type": "application/json",
            Accept: "application/x-ndjson; charset=utf-8",
          },
          timeout: this.configService.getRequestTimeout(),
          responseType: "text",
        });

        const deltaTableVersion = response.headers["delta-table-version"] as string | undefined;
        const version = deltaTableVersion ? parseInt(deltaTableVersion, 10) : 0;

        return this.parseQueryResponse(response.data as string, version);
      },
      (error) => {
        this.logger.error(
          `Failed to query table ${shareName}.${schemaName}.${tableName}: ${getAxiosErrorMessage(error)}`,
        );
        return apiErrorMapper(
          error,
          `Failed to query table ${shareName}.${schemaName}.${tableName}`,
        );
      },
    );
  }

  /**
   * Parse NDJSON metadata response (protocol + metadata)
   */
  private parseMetadataResponse(ndjsonData: string, version: number): TableMetadataResponse {
    const lines = ndjsonData.trim().split("\n");

    if (lines.length < 2) {
      throw new Error("Invalid metadata response: expected at least 2 lines");
    }

    const protocolLine = JSON.parse(lines[0]) as ProtocolLine;
    const metadataLine = JSON.parse(lines[1]) as MetadataLine;

    return {
      protocol: protocolLine.protocol,
      metadata: metadataLine.metaData,
      version,
    };
  }

  /**
   * Parse NDJSON query response (protocol + metadata + files)
   */
  private parseQueryResponse(ndjsonData: string, version: number): TableQueryResponse {
    const lines = ndjsonData.trim().split("\n");

    if (lines.length < 2) {
      throw new Error("Invalid query response: expected at least 2 lines");
    }

    const parsedLines: DeltaResponseLine[] = lines.map(
      (line) => JSON.parse(line) as DeltaResponseLine,
    );

    const protocolLine = parsedLines.find((line) => "protocol" in line);
    const metadataLine = parsedLines.find((line) => "metaData" in line);
    const fileLines = parsedLines.filter((line) => "file" in line);

    if (
      !protocolLine ||
      !metadataLine ||
      !("protocol" in protocolLine) ||
      !("metaData" in metadataLine)
    ) {
      throw new Error("Invalid query response: missing protocol or metadata");
    }

    return {
      protocol: protocolLine.protocol,
      metadata: metadataLine.metaData,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return
      files: fileLines.map((line) => (line as { file: any }).file),
      version,
    };
  }
}
