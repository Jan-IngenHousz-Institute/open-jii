import { Injectable, Logger } from "@nestjs/common";

import type { ExperimentTableMetadata } from "../../../experiments/core/models/experiment-data.model";
import type {
  DeltaFilter,
  DeltaPort,
  DeltaQueryOptions,
} from "../../../experiments/core/ports/delta.port";
import { Result, success, failure } from "../../utils/fp-utils";
import type { SchemaData } from "../databricks/services/sql/sql.types";
import { DeltaConfigService } from "./services/config/config.service";
import { DeltaDataService } from "./services/data/data.service";
import { compileDeltaFilterToPredicateHints } from "./services/filter";
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

    const parts: DeltaFilter[] = [{ op: "eq", column: "experiment_id", value: experimentId }];
    if (identifier) parts.push({ op: "eq", column: "identifier", value: identifier });
    const filter: DeltaFilter = parts.length === 1 ? parts[0] : { op: "and", filters: parts };

    const dataResult = await this.getTableData(this.configService.getMetadataTableName(), {
      filter,
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
    const { filter, columns, limitHint } = opts;

    this.logger.debug(
      `Querying ${shareName}.${schemaName}.${tableName} (filter=${filter ? "yes" : "none"}, limitHint=${limitHint})`,
    );

    const queryResult = await this.tablesService.queryTable(shareName, schemaName, tableName, {
      predicateHints: filter ? compileDeltaFilterToPredicateHints(filter) : undefined,
      limitHint,
    });
    if (queryResult.isFailure()) return failure(queryResult.error);

    const prunedFiles = filter
      ? this.dataService.pruneFilesByFilter(queryResult.value.files, filter)
      : queryResult.value.files;

    this.logger.debug(`File pruning: ${queryResult.value.files.length} → ${prunedFiles.length}`);

    return this.dataService.processFiles(
      prunedFiles,
      queryResult.value.metadata,
      limitHint,
      columns ? { columns } : undefined,
      filter,
    );
  }
}
