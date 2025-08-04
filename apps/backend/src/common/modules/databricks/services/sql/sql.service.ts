import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { AxiosResponse } from "axios";

import { getAxiosErrorMessage } from "../../../../utils/axios-error";
import { Result, AppError, tryCatch, failure, apiErrorMapper } from "../../../../utils/fp-utils";
import { DatabricksAuthService } from "../auth/auth.service";
import { DatabricksConfigService } from "../config/config.service";
import { ExecuteStatementRequest, SchemaData, StatementResponse } from "./sql.types";

@Injectable()
export class DatabricksSqlService {
  private readonly logger = new Logger(DatabricksSqlService.name);

  public static readonly SQL_STATEMENTS_ENDPOINT = "/api/2.0/sql/statements";

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
          disposition: "INLINE", // We want the data inline with the response
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
              throw AppError.internal(
                `SQL statement execution failed: ${statementResponse.status.error.message ?? "Unknown error"}`,
              );
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
          this.logger.error(`Error executing SQL query: ${getAxiosErrorMessage(error)}`);
          throw error instanceof AppError
            ? error
            : AppError.internal(
                `Databricks SQL query execution failed: ${getAxiosErrorMessage(error)}`,
              );
        }
      },
      (error) => {
        this.logger.error(`Failed to execute SQL query: ${getAxiosErrorMessage(error)}`);
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
              AppError.internal(
                `SQL statement execution failed: ${statementResponse.status.error.message ?? "Unknown error"}`,
              ),
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
        this.logger.error(`Error polling SQL statement execution: ${getAxiosErrorMessage(error)}`);
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

    const columns = response.manifest.schema.columns.map((column) => ({
      name: column.name,
      type_name: column.type_name,
      type_text: column.type_text,
    }));

    return {
      columns,
      rows: response.result.data_array,
      totalRows: response.manifest.total_row_count ?? response.result.row_count,
      truncated: response.manifest.truncated ?? false,
    };
  }
}
