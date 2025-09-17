import { Inject, Injectable, Logger } from "@nestjs/common";

import type { ExperimentDataComment } from "@repo/api";
import { zExperimentDataComments } from "@repo/api";

import type { Table } from "../../../common/modules/databricks/services/tables/tables.types";
import { AppError, failure, Result } from "../../../common/utils/fp-utils";
import { success, tryCatch } from "../../../common/utils/fp-utils";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

export interface ExperimentDataTableSchema {
  schemaName: string;
  tableName: string;
}

@Injectable()
export class ExperimentDataCommentsRepository {
  private readonly logger = new Logger(ExperimentDataCommentsRepository.name);
  private readonly DATA_TABLE_ID_COLUMN = "id";
  private readonly DATA_TABLE_COMMENTS_COLUMN = "comments";
  constructor(@Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort) {}

  async getValidatedExperimentDataTableSchema(
    experimentId: string,
    experimentName: string,
    tableName: string,
  ): Promise<Result<ExperimentDataTableSchema>> {
    // First, validate that the table exists by listing all tables
    const tablesResult = await this.databricksPort.listTables(experimentName, experimentId);
    this.logger.debug("Tables result", tablesResult);

    if (tablesResult.isFailure()) {
      return failure(AppError.internal(`Failed to list tables: ${tablesResult.error.message}`));
    }

    // Check if the specified table exists
    const tableExists = tablesResult.value.tables.some((table: Table) => table.name === tableName);

    if (!tableExists) {
      this.logger.warn(`Table ${tableName} not found in experiment ${experimentId}`);
      return failure(AppError.notFound(`Table '${tableName}' not found in this experiment`));
    }

    // Return data structure for further use
    const experimentDataTableSchema: ExperimentDataTableSchema = {
      schemaName: `exp_${experimentName}_${experimentId}`,
      tableName,
    };
    return success(experimentDataTableSchema);
  }

  async getCommentsForTableRow(
    schema: ExperimentDataTableSchema,
    rowId: string,
  ): Promise<Result<ExperimentDataComment[]>> {
    const sqlQuery = `SELECT ${this.DATA_TABLE_COMMENTS_COLUMN} FROM ${schema.tableName} WHERE ${this.DATA_TABLE_ID_COLUMN}='${rowId}'`;
    // Dummy implementation
    await tryCatch(() => {
      return;
    });
    this.logger.log("Running query", sqlQuery);
    const columnResult = [];
    try {
      const existingComments = zExperimentDataComments.parse(columnResult);

      // Parse the result. If there is a parse error, log the problem and just create an empty list.
      // If empty create an empty list
      return success(existingComments);
    } catch (error) {
      this.logger.debug("Failed to parse comments", columnResult, error);
      return success([]);
    }
  }

  async updateCommentsForTableRow(
    schema: ExperimentDataTableSchema,
    rowId: string,
    comments: ExperimentDataComment[],
  ) {
    // TODO: Safe param substitution
    const commentsColumn = JSON.stringify(comments).replace(/'/g, "''");
    const sqlQuery = `UPDATE ${schema.tableName} SET ${this.DATA_TABLE_COMMENTS_COLUMN}='${commentsColumn}' WHERE ${this.DATA_TABLE_ID_COLUMN}='${rowId}'`;
    await tryCatch(() => {
      return;
    });
    this.logger.log("Running query", sqlQuery);
    return success(comments);
  }

  async deleteCommentsForTableRow(
    schema: ExperimentDataTableSchema,
    rowId: string,
    type: "comment" | "flag",
  ) {
    // TODO
    this.logger.log(
      `Running query to delete all comments of type ${type} for row ${rowId} in schema`,
      schema,
    );
    return await tryCatch(() => {
      return;
    });
  }
}
