import { Injectable, Logger } from "@nestjs/common";

import type { ExperimentTableMetadata } from "../../../experiments/core/models/experiment-data.model";
import type { DeltaPort, DeltaQueryOptions } from "../../../experiments/core/ports/delta.port";
import { Result, success, failure } from "../../utils/fp-utils";
import type { SchemaData } from "../databricks/services/sql/sql.types";
import { DeltaConfigService } from "./services/config/config.service";
import { DeltaDataService } from "./services/data/data.service";
import { DeltaTablesService } from "./services/tables/tables.service";

/**
 * Row shape of the centrum.experiment_table_metadata table.
 * Columns mirror the DLT pipeline definition in centrum_pipeline.py.
 */
interface MetadataRow {
  experiment_id: string;
  identifier: string;
  table_type: string;
  row_count: number | bigint;
  macro_schema: string | null;
  questions_schema: string | null;
  custom_metadata_schema: string | null;
}

@Injectable()
export class DeltaAdapter implements DeltaPort {
  private readonly logger = new Logger(DeltaAdapter.name);

  readonly CENTRUM_SCHEMA_NAME: string;
  readonly RAW_DATA_TABLE_NAME: string;
  readonly DEVICE_DATA_TABLE_NAME: string;
  readonly RAW_AMBYTE_DATA_TABLE_NAME: string;
  readonly MACRO_DATA_TABLE_NAME: string;

  constructor(
    private readonly configService: DeltaConfigService,
    private readonly tablesService: DeltaTablesService,
    private readonly dataService: DeltaDataService,
  ) {
    this.CENTRUM_SCHEMA_NAME = this.configService.getSchemaName();
    this.RAW_DATA_TABLE_NAME = this.configService.getRawDataTableName();
    this.DEVICE_DATA_TABLE_NAME = this.configService.getDeviceDataTableName();
    this.RAW_AMBYTE_DATA_TABLE_NAME = this.configService.getRawAmbyteDataTableName();
    this.MACRO_DATA_TABLE_NAME = this.configService.getMacroDataTableName();
  }

  async getExperimentTableMetadata(
    experimentId: string,
    options: { identifier?: string; includeSchemas?: boolean } = {},
  ): Promise<Result<ExperimentTableMetadata[]>> {
    const { identifier, includeSchemas = true } = options;

    const filters: Record<string, string> = { experiment_id: experimentId };
    if (identifier) filters.identifier = identifier;

    const dataResult = await this.getTableData(this.configService.getMetadataTableName(), {
      filters,
    });
    if (dataResult.isFailure()) return failure(dataResult.error);

    const rows = dataResult.value.rows as unknown as MetadataRow[];
    const result: ExperimentTableMetadata[] = rows.map((row) => ({
      identifier: row.identifier,
      tableType: row.table_type === "macro" ? "macro" : "static",
      rowCount: typeof row.row_count === "bigint" ? Number(row.row_count) : row.row_count,
      ...(includeSchemas
        ? {
            macroSchema: row.macro_schema,
            questionsSchema: row.questions_schema,
            customMetadataSchema: row.custom_metadata_schema,
          }
        : {}),
    }));

    return success(result);
  }

  async getTableData(tableName: string, opts: DeltaQueryOptions = {}): Promise<Result<SchemaData>> {
    const shareName = this.configService.getShareName();
    const schemaName = this.configService.getSchemaName();
    const { filters, columns, limitHint } = opts;

    this.logger.debug(
      `Querying ${shareName}.${schemaName}.${tableName} (filters=${JSON.stringify(filters)}, limitHint=${limitHint})`,
    );

    const queryResult = await this.tablesService.queryTable(shareName, schemaName, tableName, {
      predicateHints: filters ? this.buildPredicateHints(filters) : undefined,
      limitHint,
    });
    if (queryResult.isFailure()) return failure(queryResult.error);

    const prunedFiles = filters
      ? this.dataService.pruneFilesByEquality(queryResult.value.files, filters)
      : queryResult.value.files;

    this.logger.debug(`File pruning: ${queryResult.value.files.length} → ${prunedFiles.length}`);

    return this.dataService.processFiles(
      prunedFiles,
      queryResult.value.metadata,
      limitHint,
      columns ? { columns } : undefined,
      filters,
    );
  }

  private buildPredicateHints(filters: Record<string, string>): string[] {
    return Object.entries(filters).map(([col, value]) => `${col} = '${value.replace(/'/g, "''")}'`);
  }
}
