import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosResponse } from "axios";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { ErrorCodes } from "../../../../utils/error-codes";
import { Result, AppError, tryCatch, failure, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import { ExecuteStatementRequest, SchemaData, StatementResponse } from "./sql.types";

@Injectable()
export class DatabricksSqlService {
  private readonly logger = new Logger(DatabricksSqlService.name);

  public static readonly SQL_STATEMENTS_ENDPOINT = "/api/2.0/sql/statements";

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

  async executeSqlQuery(schemaName: string, sqlStatement: string): Promise<Result<SchemaData>> {
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
          wait_timeout: "50s", // Maximum supported wait time
          disposition: "INLINE",
          format: "JSON_ARRAY",
        };

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

          // Check if the statement is in a terminal state
          if (statementResponse.status.state === "SUCCEEDED") {
            return this.formatExperimentDataResponse(statementResponse);
          } else if (["FAILED", "CANCELED", "CLOSED"].includes(statementResponse.status.state)) {
            if (statementResponse.status.error) {
              throw DatabricksSqlService.mapSqlStatementError(statementResponse.status.error);
            }
            throw AppError.internal(
              `SQL statement execution ${statementResponse.status.state.toLowerCase()}`,
            );
          }

          // For PENDING or RUNNING states, poll until completion
          const pollResult = await this.pollStatementExecution(
            token,
            statementResponse.statement_id,
          );

          if (pollResult.isFailure()) {
            throw pollResult.error;
          }

          return this.formatExperimentDataResponse(pollResult.value);
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

  private async pollStatementExecution(
    token: string,
    statementId: string,
  ): Promise<Result<StatementResponse>> {
    const maxAttempts = 30; // Maximum polling attempts
    const pollingIntervalMs = 1000; // 1 second between polls
    const host = this.configService.getHost();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const getUrl = `${host}${DatabricksSqlService.SQL_STATEMENTS_ENDPOINT}/${statementId}`;

      try {
        const response: AxiosResponse<StatementResponse> = await this.httpService.axiosRef.get(
          getUrl,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: DatabricksConfigService.DEFAULT_REQUEST_TIMEOUT,
          },
        );

        const statementResponse = response.data;

        // Check if the statement finished
        if (statementResponse.status.state === "SUCCEEDED") {
          return tryCatch(
            () => statementResponse,
            (error) => AppError.internal(`Failed to process SQL response: ${String(error)}`),
          );
        } else if (["FAILED", "CANCELED", "CLOSED"].includes(statementResponse.status.state)) {
          if (statementResponse.status.error) {
            return failure(
              DatabricksSqlService.mapSqlStatementError(statementResponse.status.error),
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
        this.logger.error({
          msg: "Error polling SQL statement execution",
          errorCode: ErrorCodes.DATABRICKS_SQL_FAILED,
          operation: "pollStatementExecution",
          error,
        });
        return failure(
          AppError.internal(`Databricks SQL polling failed: ${getAxiosErrorMessage(error)}`),
        );
      }
    }

    // If we've exhausted our polling attempts, return a timeout error
    return failure(
      AppError.internal("SQL statement execution timed out after multiple polling attempts"),
    );
  }

  private formatExperimentDataResponse(response: StatementResponse): SchemaData {
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

    return {
      columns,
      rows: response.result.data_array ?? [],
      totalRows: response.manifest.total_row_count ?? response.result.row_count,
      truncated: response.manifest.truncated ?? false,
    };
  }
}
