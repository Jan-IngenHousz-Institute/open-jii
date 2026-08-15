import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { AppError, Result, tryCatch, apiErrorMapper, failure } from "../../../../utils/fp-utils";
import { DeltaConfigService } from "../config/delta-config.service";
import type {
  DeltaFile,
  DeltaFileStats,
  DeltaResponseLine,
  EndStreamAction,
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

  /**
   * Ceiling on files per scan. Each pre-signed URL is ~1 KB of SQL text, so
   * this bounds the statement at a few MB and stops a runaway listing from
   * exhausting memory before DuckDB ever sees it.
   */
  private static readonly MAX_FILES = 5000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: DeltaConfigService,
  ) {}

  /**
   * Pre-signed parquet URLs for one table, narrowed by `column = value`
   * equality scopes. Hints are advisory server-side and the stats pruning
   * here is best-effort; correctness comes from the SQL WHERE.
   *
   * No `limitHint` is sent: the protocol lets the server drop files to
   * satisfy it, which would silently truncate the row set the SQL then
   * paginates with LIMIT/OFFSET.
   */
  async getDataFileUrls(tableName: string, scopes: [string, string][]): Promise<Result<string[]>> {
    try {
      this.configService.assertReady();
    } catch (error) {
      return failure(
        error instanceof AppError
          ? error
          : AppError.internal(`Delta Sharing configuration is unusable: ${String(error)}`),
      );
    }

    const served: DeltaFile[] = [];
    let pageToken: string | undefined;

    // The listing is paged: a response ends with an EndStreamAction carrying
    // nextPageToken when more files remain. Stopping at page one would scan a
    // subset of the table and silently under-report every row count.
    do {
      const queryResult = await this.queryTable(tableName, scopes, pageToken);
      if (queryResult.isFailure()) {
        return queryResult;
      }
      served.push(...queryResult.value.files);
      pageToken = queryResult.value.nextPageToken;

      if (served.length > DeltaSharingService.MAX_FILES) {
        return failure(
          AppError.internal(
            `Delta Sharing returned more than ${DeltaSharingService.MAX_FILES} files for '${tableName}'; refusing to build a scan that large`,
            "DELTA_FILE_LIMIT_EXCEEDED",
          ),
        );
      }
    } while (pageToken);

    const pruned = served.filter((file) => this.canFileMatch(file, scopes));
    // Pruning is an optimisation, never a filter. If it would eliminate every
    // file the stats are unusable, so scan what the server served and let the
    // SQL WHERE decide; otherwise a bad stats blob becomes silent data loss.
    const files = pruned.length > 0 ? pruned : served;

    this.logger.debug({
      msg: "Delta Sharing file pruning",
      operation: "getDataFileUrls",
      tableName,
      served: served.length,
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
    pageToken?: string,
  ): Promise<Result<TableQueryResponse>> {
    return await tryCatch(
      async () => {
        const endpoint = this.configService.getEndpoint();
        const share = encodeURIComponent(this.configService.getShareName());
        const schema = encodeURIComponent(this.configService.getSchemaName());
        const table = encodeURIComponent(tableName);
        const url = `${endpoint}/shares/${share}/schemas/${schema}/tables/${table}/query`;

        const predicateHints = scopes.map(
          ([column, value]) =>
            // Spark string literals honour backslash escapes, so both it and
            // the quote must be doubled before the value is embedded.
            `\`${column.replace(/`/g, "``")}\` = '${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`,
        );

        const response = await this.httpService.axiosRef.post(
          url,
          { predicateHints, ...(pageToken !== undefined ? { pageToken } : {}) },
          {
            headers: {
              Authorization: `Bearer ${this.configService.getBearerToken()}`,
              "Content-Type": "application/json",
              Accept: "application/x-ndjson; charset=utf-8",
            },
            timeout: this.configService.getRequestTimeout(),
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
    const endStream = parsed.find(
      (line): line is { endStreamAction: EndStreamAction } => "endStreamAction" in line,
    );

    if (!protocolLine || !metadataLine) {
      throw new Error("Invalid Delta Sharing query response: missing protocol or metadata");
    }

    return {
      protocol: protocolLine.protocol,
      metadata: metadataLine.metaData,
      files,
      version,
      nextPageToken: endStream?.endStreamAction.nextPageToken,
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
      // Only string stats are safe to compare: the scopes are all string
      // columns, and lexicographic order matches Delta's ordering for them.
      // A number here would be compared as text ("9" > "10"), so skip it.
      if (typeof min !== "string" || typeof max !== "string") {
        continue;
      }
      // Delta truncates long string stats (32 chars by default), which makes
      // the bound a prefix rather than a real bound. A 36-char UUID scope
      // would then fail `value <= max` and drop a file that does match.
      if (
        DeltaSharingService.isPossiblyTruncated(min, value) ||
        DeltaSharingService.isPossiblyTruncated(max, value)
      ) {
        continue;
      }
      if (!(min <= value && value <= max)) {
        return false;
      }
    }
    return true;
  }

  /** A shorter bound that prefixes the value may be a truncated stat. */
  private static isPossiblyTruncated(bound: string, value: string): boolean {
    return bound.length < value.length && value.startsWith(bound);
  }
}
