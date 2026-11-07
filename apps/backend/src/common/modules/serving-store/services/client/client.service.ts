import { ClickHouseError, createClient } from "@clickhouse/client";
import type { ClickHouseClient } from "@clickhouse/client";
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { z } from "zod";

import { PAGE_TOO_LARGE_MESSAGE } from "../../../../../experiments/core/models/experiment-data.model";
import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, failure, tryCatch } from "../../../../utils/fp-utils";
import type { Result } from "../../../../utils/fp-utils";
import { ServingStoreConfigService } from "../config/config.service";

export interface StoreResult {
  rows: unknown[][];
}

const zRows = z.array(z.array(z.unknown()));

@Injectable()
export class ServingStoreClientService implements OnModuleDestroy {
  private readonly logger = new Logger(ServingStoreClientService.name);

  /** The reader may run for 30 s, so the store's own refusal ends a slow read, not the socket. */
  private static readonly REQUEST_TIMEOUT_MS = 35_000;

  private readonly client: ClickHouseClient | null;

  constructor(configService: ServingStoreConfigService) {
    const config = configService.getConfig();
    this.client =
      config === null
        ? null
        : createClient({
            url: config.url,
            username: config.username,
            password: config.password,
            database: "store",
            request_timeout: ServingStoreClientService.REQUEST_TIMEOUT_MS,
            clickhouse_settings: {
              // It would also quote the integers inside a payload's JSON, which the warehouse
              // writes bare; reads write their integer columns as text themselves.
              output_format_json_quote_64bit_integers: 0,
              output_format_json_escape_forward_slashes: 0,
              // A payload field is projected under its own name, which may be a column's, such as
              // user_id; the column must still read as the column everywhere else in the query.
              prefer_column_name_to_alias: 1,
              // The client holds the whole result, so a page past 25 MiB is refused rather than
              // read. The store refuses it before sending only when it waits for the end of the
              // query; otherwise the refusal arrives mid-stream, which the client reads from 25.11.
              max_result_bytes: "26214400",
              result_overflow_mode: "throw",
              wait_end_of_query: 1,
              // Copies of a row always land in the same month, so FINAL can merge each month
              // separately, which is faster.
              do_not_merge_across_partitions_select_final: 1,
            },
          });
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async query(sql: string): Promise<Result<StoreResult>> {
    const client = this.client;
    if (client === null) {
      return failure(AppError.internal("No serving store is configured", "STORE_NOT_CONFIGURED"));
    }

    return tryCatch(
      async () => {
        const resultSet = await client.query({ query: sql, format: "JSONCompactEachRow" });
        return { rows: zRows.parse(await resultSet.json()) };
      },
      (error) => this.storeError(error),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }

  private storeError(error: unknown): AppError {
    this.logger.error({
      msg: "Serving store query failed",
      errorCode: ErrorCodes.SERVING_STORE_QUERY_FAILED,
      operation: "query",
      error,
    });

    const isStoreTimeout = error instanceof ClickHouseError && error.type === "TIMEOUT_EXCEEDED";
    const isClientTimeout = error instanceof Error && error.message.startsWith("Timeout error");
    if (isStoreTimeout || isClientTimeout) {
      return AppError.timeout("The store did not finish the read within 30 s", "STORE_TIMEOUT");
    }

    const isPageTooLarge =
      error instanceof ClickHouseError && error.type === "TOO_MANY_ROWS_OR_BYTES";
    if (isPageTooLarge) {
      return AppError.badRequest(PAGE_TOO_LARGE_MESSAGE, ErrorCodes.PAGE_TOO_LARGE);
    }

    const isMemoryLimit =
      error instanceof ClickHouseError && error.type === "MEMORY_LIMIT_EXCEEDED";
    if (isMemoryLimit) {
      return AppError.internal(
        "The read needs more memory than the store allows one query",
        "STORE_MEMORY_LIMIT",
      );
    }

    // ClickHouse's message repeats the statement, which holds the ids a page sorts and filters by;
    // it stays in the log above, and the caller learns only that the read failed.
    return AppError.internal(
      "The serving store could not answer the read",
      ErrorCodes.SERVING_STORE_QUERY_FAILED,
    );
  }
}
