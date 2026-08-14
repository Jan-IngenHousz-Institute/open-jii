import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { Result, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DuckDbConfigService } from "../config/duckdb-config.service";
import type {
  DeltaFile,
  DeltaFileStats,
  DeltaResponseLine,
  TableQueryResponse,
} from "./delta-sharing.types";

/**
 * Minimal Delta Sharing client for the DuckDB read engine: asks the server
 * for a table's data-file URLs (scoped by predicate hints, best-effort per
 * protocol) and prunes the returned files client-side via their min/max
 * stats. The actual row-level filtering happens in DuckDB SQL.
 */
@Injectable()
export class DeltaSharingService {
  private readonly logger = new Logger(DeltaSharingService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DuckDbConfigService,
  ) {}

  /**
   * Pre-signed parquet URLs for one table, narrowed by `column = value`
   * equality scopes. Hints are advisory server-side; the stats pruning here
   * is also best-effort. Correctness comes from the SQL WHERE.
   */
  async getDataFileUrls(
    tableName: string,
    scopes: [string, string][],
    limitHint?: number,
  ): Promise<Result<string[]>> {
    const queryResult = await this.queryTable(tableName, scopes, limitHint);
    if (queryResult.isFailure()) {
      return queryResult;
    }

    const files = queryResult.value.files.filter((file) => this.canFileMatch(file, scopes));
    this.logger.debug({
      msg: "Delta Sharing file pruning",
      operation: "getDataFileUrls",
      tableName,
      served: queryResult.value.files.length,
      kept: files.length,
    });

    return tryCatch(
      () => files.map((file) => file.url),
      (error) => apiErrorMapper(error, "Delta Sharing file listing"),
    );
  }

  private async queryTable(
    tableName: string,
    scopes: [string, string][],
    limitHint?: number,
  ): Promise<Result<TableQueryResponse>> {
    return await tryCatch(
      async () => {
        const endpoint = this.configService.getDeltaEndpoint();
        const share = encodeURIComponent(this.configService.getDeltaShareName());
        const schema = encodeURIComponent(this.configService.getDeltaSchemaName());
        const table = encodeURIComponent(tableName);
        const url = `${endpoint}/shares/${share}/schemas/${schema}/tables/${table}/query`;

        const predicateHints = scopes.map(
          ([column, value]) =>
            `\`${column.replace(/`/g, "``")}\` = '${value.replace(/'/g, "''")}'`,
        );

        const response = await this.httpService.axiosRef.post(
          url,
          { predicateHints, ...(limitHint !== undefined ? { limitHint } : {}) },
          {
            headers: {
              Authorization: `Bearer ${this.configService.getDeltaBearerToken()}`,
              "Content-Type": "application/json",
              Accept: "application/x-ndjson; charset=utf-8",
            },
            timeout: this.configService.getDeltaRequestTimeout(),
            responseType: "text",
          },
        );

        const versionHeader = (response.headers as Record<string, string | undefined>)[
          "delta-table-version"
        ];
        return this.parseQueryResponse(
          response.data as string,
          versionHeader ? parseInt(versionHeader, 10) : 0,
        );
      },
      (error) => {
        this.logger.error({
          msg: "Delta Sharing table query failed",
          operation: "queryTable",
          tableName,
          error: getAxiosErrorMessage(error),
        });
        return apiErrorMapper(error, `Delta Sharing query for table '${tableName}'`);
      },
    );
  }

  private parseQueryResponse(ndjsonData: string, version: number): TableQueryResponse {
    const lines = ndjsonData.trim().split("\n");
    const parsed = lines
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as DeltaResponseLine);

    const protocolLine = parsed.find(
      (line): line is { protocol: TableQueryResponse["protocol"] } => "protocol" in line,
    );
    const metadataLine = parsed.find(
      (line): line is { metaData: TableQueryResponse["metadata"] } => "metaData" in line,
    );
    const files = parsed
      .filter((line): line is { file: DeltaFile } => "file" in line)
      .map((line) => line.file);

    if (!protocolLine || !metadataLine) {
      throw new Error("Invalid Delta Sharing query response: missing protocol or metadata");
    }

    return {
      protocol: protocolLine.protocol,
      metadata: metadataLine.metaData,
      files,
      version,
    };
  }

  /**
   * Keep a file unless its partition value or min/max stats prove the scope
   * can't match. Conservative: unknown stats keep the file.
   */
  private canFileMatch(file: DeltaFile, scopes: [string, string][]): boolean {
    for (const [column, value] of scopes) {
      const partitionValue = file.partitionValues[column];
      if (partitionValue !== undefined && partitionValue !== value) {
        return false;
      }

      if (!file.stats) {
        continue;
      }
      let stats: DeltaFileStats;
      try {
        stats = JSON.parse(file.stats) as DeltaFileStats;
      } catch {
        continue;
      }
      const min = stats.minValues?.[column];
      const max = stats.maxValues?.[column];
      if (min === undefined || max === undefined) {
        continue;
      }
      if (!(String(min) <= value && value <= String(max))) {
        return false;
      }
    }
    return true;
  }
}
