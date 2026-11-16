import { createClient } from "@clickhouse/client";
import type { ClickHouseClient } from "@clickhouse/client";
import { Injectable, Logger } from "@nestjs/common";
import type { OnApplicationShutdown } from "@nestjs/common";
import type { z } from "zod";

import { ErrorCodes } from "../../../../utils/error-codes";
import { AppError, failure, success, tryCatch } from "../../../../utils/fp-utils";
import type { Result } from "../../../../utils/fp-utils";
import { ServingStoreConfigService } from "../config/config.service";

/** The outbox's connection to the store, as the copier, which may insert into its two tables. */
@Injectable()
export class ServingStoreCopierClientService implements OnApplicationShutdown {
  private readonly logger = new Logger(ServingStoreCopierClientService.name);

  // A copy runs inside the outbox's two-minute claim, and its statements are small.
  private static readonly REQUEST_TIMEOUT_MS = 30_000;

  private readonly client: ClickHouseClient | null;

  constructor(configService: ServingStoreConfigService) {
    const config = configService.getConfig();
    const copier = config?.copier ?? null;
    this.client =
      config === null || copier === null
        ? null
        : createClient({
            url: config.url,
            username: copier.username,
            password: copier.password,
            database: "store",
            request_timeout: ServingStoreCopierClientService.REQUEST_TIMEOUT_MS,
            // Times arrive as ISO text with a zone, which the default format refuses.
            clickhouse_settings: { date_time_input_format: "best_effort" },
          });
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async insert(table: string, rows: readonly object[]): Promise<Result<void>> {
    const client = this.client;
    if (client === null) {
      return this.notConfigured();
    }
    if (rows.length === 0) {
      return success(undefined);
    }

    return tryCatch(
      async () => {
        await client.insert({ table, values: rows, format: "JSONEachRow" });
      },
      (error) => this.storeError("insert", error),
    );
  }

  async rows<T>(
    sql: string,
    params: Record<string, unknown>,
    schema: z.ZodType<T>,
  ): Promise<Result<T[]>> {
    const client = this.client;
    if (client === null) {
      return this.notConfigured();
    }

    return tryCatch(
      async () => {
        const resultSet = await client.query({
          query: sql,
          query_params: params,
          format: "JSONEachRow",
        });
        const rows: unknown[] = await resultSet.json();
        return rows.map((row) => schema.parse(row));
      },
      (error) => this.storeError("rows", error),
    );
  }

  /** After the outbox worker's own shutdown hook, so a copy in flight keeps its connection. */
  async onApplicationShutdown(): Promise<void> {
    await this.client?.close();
  }

  private notConfigured<T>(): Result<T> {
    return failure(
      AppError.internal("No serving store copier is configured", "STORE_NOT_CONFIGURED"),
    );
  }

  private storeError(operation: string, error: unknown): AppError {
    this.logger.error({
      msg: "Serving store copy failed",
      errorCode: ErrorCodes.SERVING_STORE_QUERY_FAILED,
      operation,
      error,
    });
    return AppError.internal(
      "The serving store could not take the copy",
      ErrorCodes.SERVING_STORE_QUERY_FAILED,
    );
  }
}
