import type { Readable } from "stream";

import type { UploadFileResponse } from "../../../common/modules/databricks/services/files/files.types";
import type {
  DatabricksHealthCheck,
  DatabricksJobRunResponse,
} from "../../../common/modules/databricks/services/jobs/jobs.types";
import type {
  AggregationSpec,
  FilterCondition,
} from "../../../common/modules/databricks/services/query-builder/query-builder.types";
import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import type { Result } from "../../../common/utils/fp-utils";
import type { ExportMetadata } from "../models/experiment-data-exports.model";
import type { ExperimentTableMetadata } from "../models/experiment-data.model";

export const DATABRICKS_PORT = Symbol("DATABRICKS_PORT");

/** Contract for Databricks operations consumed by the experiments domain. */
export interface DatabricksPort {
  readonly CATALOG_NAME: string;
  readonly CENTRUM_SCHEMA_NAME: string;

  readonly RAW_DATA_TABLE_NAME: string;
  readonly DEVICE_DATA_TABLE_NAME: string;
  readonly RAW_AMBYTE_DATA_TABLE_NAME: string;
  readonly MACRO_DATA_TABLE_NAME: string;

  healthCheck(): Promise<Result<DatabricksHealthCheck>>;

  /**
   * Row counts and (optionally) schemas from the experiment_table_metadata
   * cache table.
   */
  getExperimentTableMetadata(
    experimentId: string,
    options?: {
      identifier?: string;
      includeSchemas?: boolean;
    },
  ): Promise<Result<ExperimentTableMetadata[]>>;

  /** Build a SQL query for experiment data, dispatching by table type. */
  buildExperimentQuery(params: {
    tableName: string;
    tableType: "static" | "macro";
    experimentId: string;
    columns?: string[];
    variants?: { columnName: string; schema: string }[];
    exceptColumns?: string[];
    filters?: FilterCondition[];
    aggregation?: AggregationSpec;
    distinct?: boolean;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  }): Result<string>;

  executeSqlQuery(schemaName: string, sqlStatement: string): Promise<Result<SchemaData>>;

  /** Upload to /Volumes/{catalog}/{schema}/data-imports/{experimentId}/{sourceType}/{dir}/{file}. */
  uploadExperimentData(
    schemaName: string,
    experimentId: string,
    sourceType: string,
    directoryName: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<Result<UploadFileResponse>>;

  triggerAmbyteProcessingJob(
    params: Record<string, string>,
  ): Promise<Result<DatabricksJobRunResponse>>;

  triggerDataExportJob(
    experimentId: string,
    tableName: string,
    format: string,
    userId: string,
  ): Promise<Result<DatabricksJobRunResponse>>;

  streamExport(
    exportId: string,
    experimentId: string,
  ): Promise<Result<{ stream: Readable; filePath: string; tableName: string }>>;

  /** Completed export metadata for an experiment table from Delta Lake. */
  getExportMetadata(experimentId: string, tableName: string): Promise<Result<SchemaData>>;

  /** Active (in-progress) exports from job runs. */
  getActiveExports(experimentId: string, tableName: string): Promise<Result<ExportMetadata[]>>;

  /**
   * Failed exports from completed job runs.
   * `completedExportRunIds` is used to deduplicate against the completed exports table.
   */
  getFailedExports(
    experimentId: string,
    tableName: string,
    completedExportRunIds: Set<number>,
  ): Promise<Result<ExportMetadata[]>>;
}
