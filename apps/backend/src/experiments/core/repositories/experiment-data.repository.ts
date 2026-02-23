import { Injectable, Inject, Logger } from "@nestjs/common";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { Result, success, failure } from "../../../common/utils/fp-utils";
import { ExperimentDto } from "../models/experiment.model";
import { DELTA_PORT } from "../ports/delta.port";
import type { DeltaPort } from "../ports/delta.port";

export interface SchemaDataDto {
  columns: {
    name: string;
    type_name: string;
    type_text: string;
  }[];
  rows: Record<string, string | null>[];
  totalRows: number;
  truncated: boolean;
}

export interface TableDataDto {
  name: string;
  catalog_name: string;
  schema_name: string;
  data?: SchemaDataDto;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
}

/**
 * Repository for experiment data operations.
 * Fetches data via Delta Sharing — downloads parquet files and decodes locally.
 * Variant columns are resolved automatically by hyparquet (no SQL expansion needed).
 */
@Injectable()
export class ExperimentDataRepository {
  private readonly logger = new Logger(ExperimentDataRepository.name);

  constructor(@Inject(DELTA_PORT) private readonly deltaPort: DeltaPort) {}

  /**
   * Get table data for an experiment via Delta Sharing.
   *
   * When `columns` is provided, fetches only those columns (full table, no pagination).
   * Otherwise fetches a page of all columns.
   */
  async getTableData(params: {
    experimentId: string;
    experiment: ExperimentDto;
    tableName: string;
    columns?: string[];
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
  }): Promise<Result<TableDataDto[]>> {
    const { experimentId, experiment, tableName, columns, page = 1, pageSize = 5 } = params;

    const dataResult = columns
      ? await this.deltaPort.getTableColumns(experiment.name, experimentId, tableName, columns)
      : await this.deltaPort.getTableData(experiment.name, experimentId, tableName, page, pageSize);

    if (dataResult.isFailure()) {
      this.logger.error({
        msg: "Failed to fetch table data via Delta Sharing",
        tableName,
        experimentId,
        error: dataResult.error.message,
      });
      return failure(dataResult.error);
    }

    const schemaData = dataResult.value;
    const totalRows = schemaData.totalRows;
    const totalPages = columns ? 1 : Math.ceil(totalRows / pageSize);

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: "default",
        data: this.transformSchemaData(schemaData),
        page: columns ? 1 : page,
        pageSize: columns ? totalRows : pageSize,
        totalRows,
        totalPages,
      },
    ]);
  }

  /**
   * Transform Delta SchemaData (Record<string, unknown>[] rows) to the DTO format.
   * Complex values (objects, arrays from variant decode) are JSON-stringified
   * so the frontend receives uniform Record<string, string | null>[].
   */
  private transformSchemaData(schemaData: SchemaData): SchemaDataDto {
    return {
      columns: schemaData.columns,
      rows: (schemaData.rows as Record<string, unknown>[]).map((row) => {
        const dataRow: Record<string, string | null> = {};
        for (const col of schemaData.columns) {
          const value = row[col.name];
          if (value == null) {
            dataRow[col.name] = null;
          } else if (typeof value === "string") {
            dataRow[col.name] = value;
          } else {
            dataRow[col.name] = JSON.stringify(value);
          }
        }
        return dataRow;
      }),
      totalRows: schemaData.totalRows,
      truncated: schemaData.truncated,
    };
  }
}
