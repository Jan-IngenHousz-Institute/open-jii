import { Injectable, Inject, Logger } from "@nestjs/common";

import { Result, success, failure, AppError } from "../../../../../../common/utils/fp-utils";
import { DATABRICKS_PORT } from "../../../../../core/ports/databricks.port";
import type { DatabricksPort } from "../../../../../core/ports/databricks.port";
import type { ExperimentDataQueryStrategy } from "../get-experiment-data";

@Injectable()
export class MacroDataQueryStrategy implements ExperimentDataQueryStrategy {
  private readonly logger = new Logger(MacroDataQueryStrategy.name);

  constructor(@Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort) {}

  async buildQuery(
    experimentId: string,
    tableName: string,
    columns?: string[],
    orderBy?: string,
    orderDirection?: "ASC" | "DESC",
    limit?: number,
    offset?: number,
  ): Promise<Result<string>> {
    const schemaResult = await this.getMacroSchema(experimentId, tableName);
    if (schemaResult.isFailure()) return schemaResult;

    const query = this.databricksPort.buildVariantParseQuery({
      schema: "centrum",
      table: "experiment_macro_data",
      selectColumns: columns ?? ["*"],
      variantColumn: "macro_output",
      variantSchema: schemaResult.value,
      whereClause: `experiment_id = '${experimentId}' AND macro_filename = '${tableName}'`,
      orderBy: orderBy ? `${orderBy} ${orderDirection ?? "ASC"}` : undefined,
      limit,
      offset,
    });

    return success(query);
  }

  /**
   * Get VARIANT schema for a macro table
   */
  private async getMacroSchema(
    experimentId: string,
    macroFilename: string,
  ): Promise<Result<string>> {
    const schemaQuery = this.databricksPort.buildSchemaLookupQuery({
      schema: "centrum",
      experimentId,
      macroFilename,
    });

    const result = await this.databricksPort.executeSqlQuery("centrum", schemaQuery);

    if (result.isFailure() || result.value.rows.length === 0) {
      this.logger.warn({
        msg: "Macro not found in experiment",
        operation: "getMacroSchema",
        macroFilename,
        experimentId,
      });
      return failure(AppError.notFound(`Macro '${macroFilename}' not found in this experiment`));
    }

    const schemaValue = result.value.rows[0]?.[0];
    if (typeof schemaValue !== "string" || !schemaValue) {
      this.logger.error({
        msg: "Invalid schema value returned from database",
        operation: "getMacroSchema",
        macroFilename,
        experimentId,
        schemaValue,
      });
      return failure(AppError.internal("Invalid macro schema format"));
    }

    return success(schemaValue);
  }
}
