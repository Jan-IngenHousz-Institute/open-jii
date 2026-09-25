import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosResponse } from "axios";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { ErrorCodes } from "../../../../utils/error-codes";
import { Result, AppError, tryCatch, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import {
  ExecuteStatementRequest,
  ResultChunk,
  SchemaData,
  StatementParameter,
  StatementResponse,
} from "./sql.types";

@Injectable()
export class DatabricksSqlService {
  private readonly logger = new Logger(DatabricksSqlService.name);

  public static readonly SQL_STATEMENTS_ENDPOINT = "/api/2.0/sql/statements";

  /**
   * How long the warehouse may take before it cancels the statement itself. CloudFront and the
   * ALB drop the client at 60 s, so an answer later than this reaches nobody, and a statement
   * left running only queues ahead of the reads that follow.
   */
  private static readonly WAIT_TIMEOUT = "50s";

  /**
   * The most an INLINE result may hold. Without a byte limit a larger result fails the statement
   * as a BAD_REQUEST; with one the warehouse returns what fits and marks it truncated.
   */
  private static readonly INLINE_BYTE_LIMIT = 26_214_400;

  /**
   * Determine the appropriate AppError for a Databricks SQL statement failure.
   * Databricks returns error_code "BAD_REQUEST" or "INVALID_PARAMETER_VALUE" for
   * client errors (invalid columns, missing tables, syntax errors, bad parameters)
   * so we map those to a 400 Bad Request. Everything else becomes a 500.
   */
  private static mapSqlStatementError(error: { message?: string; error_code?: string }): AppError {
    const message = error.message ?? "Unknown error";
    const clientErrorCodes = ["BAD_REQUEST", "INVALID_PARAMETER_VALUE"];

    if (error.error_code && clientErrorCodes.includes(error.error_code)) {
      return AppError.badRequest(message, "INVALID_SQL_QUERY");
    }

    return AppError.internal(`SQL statement execution failed: ${message}`);
  }

  constructor(
    private readonly httpService: HttpService,
    private readonly authService: DatabricksAuthService,
    private readonly configService: DatabricksConfigService,
  ) {}

  async executeSqlQuery(
    schemaName: string,
    sqlStatement: string,
    parameters?: StatementParameter[],
  ): Promise<Result<SchemaData>> {
    return await tryCatch(
      async () => {
        const tokenResult = await this.authService.getAccessToken();
        if (tokenResult.isFailure()) {
          throw tokenResult.error;
        }

        const token = tokenResult.value;
        this.logger.debug(`Executing SQL query in schema ${schemaName}: ${sqlStatement}`);

        const host = this.configService.getHost();
        const statementUrl = `${host}${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/`;
        const requestBody: ExecuteStatementRequest = {
          statement: sqlStatement,
          warehouse_id: this.configService.getWarehouseId(),
          schema: schemaName,
          catalog: this.configService.getCatalogName(),
          wait_timeout: DatabricksSqlService.WAIT_TIMEOUT,
          on_wait_timeout: "CANCEL",
          disposition: "INLINE",
          format: "JSON_ARRAY",
          byte_limit: DatabricksSqlService.INLINE_BYTE_LIMIT,
          parameters,
        };
        const startedAt = performance.now();

        try {
          const response: AxiosResponse<StatementResponse> = await this.httpService.axiosRef.post(
            statementUrl,
            requestBody,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              timeout: 60000, // Longer timeout for SQL queries
            },
          );

          const statementResponse = response.data;
          const { state, error } = statementResponse.status;

          if (state === "SUCCEEDED") {
            const remainingRows = await this.fetchRemainingChunks(
              host,
              token,
              statementResponse.result?.next_chunk_internal_link,
            );
            return this.completeStatement(statementResponse, remainingRows, startedAt);
          }
          // The deadline cancellation carries no error; any other cancellation says why.
          const isDeadlineCancel = state === "CANCELED" && error === undefined;
          if (isDeadlineCancel) {
            throw AppError.timeout(
              `The warehouse did not finish within ${DatabricksSqlService.WAIT_TIMEOUT}`,
              "WAREHOUSE_TIMEOUT",
            );
          }
          if (error) {
            throw DatabricksSqlService.mapSqlStatementError(error);
          }
          throw AppError.internal(`SQL statement execution ${state.toLowerCase()}`);
        } catch (error) {
          throw error instanceof AppError
            ? error
            : AppError.internal(
                `Databricks SQL query execution failed: ${getAxiosErrorMessage(error)}`,
              );
        }
      },
      (error) => {
        this.logger.error({
          msg: "Failed to execute SQL query",
          errorCode: ErrorCodes.DATABRICKS_SQL_FAILED,
          operation: "executeSqlQuery",
          error,
        });
        // Preserve AppError instances (e.g. badRequest for invalid column references)
        if (error instanceof AppError) {
          return error;
        }
        return apiErrorMapper(`Databricks SQL query execution: ${getAxiosErrorMessage(error)}`);
      },
    );
  }

  /**
   * An INLINE result arrives in chunks and the statement response holds only the first. Each
   * chunk links to the next, and the last one has no link.
   */
  private async fetchRemainingChunks(
    host: string,
    token: string,
    firstLink: string | undefined,
  ): Promise<(string | null)[][]> {
    const chunks: (string | null)[][][] = [];
    let link = firstLink;

    while (link !== undefined) {
      const response: AxiosResponse<ResultChunk> = await this.httpService.axiosRef.get(
        `${host}${link}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000,
        },
      );
      chunks.push(response.data.data_array ?? []);
      link = response.data.next_chunk_internal_link;
    }

    return chunks.flat();
  }

  private completeStatement(
    response: StatementResponse,
    remainingRows: (string | null)[][],
    startedAt: number,
  ): SchemaData {
    const data = this.formatExperimentDataResponse(response, remainingRows);

    this.logger.log({
      msg: "Warehouse statement completed",
      operation: "executeSqlQuery",
      statementId: response.statement_id,
      durationMs: Math.round(performance.now() - startedAt),
      rowCount: data.totalRows,
      byteCount: response.manifest?.total_byte_count,
      chunkCount: response.manifest?.total_chunk_count,
      truncated: data.truncated,
    });

    return data;
  }

  private formatExperimentDataResponse(
    response: StatementResponse,
    remainingRows: (string | null)[][],
  ): SchemaData {
    if (!response.manifest || !response.result) {
      throw AppError.internal("Invalid SQL statement response: missing manifest or result data");
    }
    // DDL statement do not return any schema data
    if (response.manifest.schema.column_count === 0) {
      return {
        columns: [],
        rows: [],
        totalRows: 0,
        truncated: false,
      };
    }

    const columns = response.manifest.schema.columns.map((column) => ({
      name: column.name,
      type_name: column.type_name,
      type_text: column.type_text,
      position: column.position,
    }));

    const rows = (response.result.data_array ?? []).concat(remainingRows);

    return {
      columns,
      rows,
      totalRows: response.manifest.total_row_count ?? rows.length,
      truncated: response.manifest.truncated ?? false,
    };
  }
}
