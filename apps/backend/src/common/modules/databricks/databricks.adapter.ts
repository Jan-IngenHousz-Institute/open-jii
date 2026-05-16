import { Injectable, Logger } from "@nestjs/common";
import { Readable } from "stream";

import { ExperimentTableName } from "@repo/api/schemas/experiment.schema";

import type { ExportMetadata } from "../../../experiments/core/models/experiment-data-exports.model";
import type { ExperimentTableMetadata } from "../../../experiments/core/models/experiment-data.model";
import { DatabricksPort as ExperimentDatabricksPort } from "../../../experiments/core/ports/databricks.port";
import { Result, success, failure, AppError } from "../../utils/fp-utils";
import { DatabricksConfigService } from "./services/config/config.service";
import { DatabricksFilesService } from "./services/files/files.service";
import type { UploadFileResponse } from "./services/files/files.types";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import type { DatabricksHealthCheck } from "./services/jobs/jobs.types";
import type { DatabricksJobRunResponse } from "./services/jobs/jobs.types";
import { JobLifecycleState, JobResultState } from "./services/jobs/jobs.types";
import { QueryBuilderService } from "./services/query-builder/query-builder.service";
import type {
  AggregationSpec,
  FilterCondition,
} from "./services/query-builder/query-builder.types";
import { DatabricksSqlService } from "./services/sql/sql.service";
import type { SchemaData } from "./services/sql/sql.types";

@Injectable()
export class DatabricksAdapter implements ExperimentDatabricksPort {
  private readonly logger = new Logger(DatabricksAdapter.name);

  readonly CATALOG_NAME: string;
  readonly CENTRUM_SCHEMA_NAME: string;

  readonly RAW_DATA_TABLE_NAME: string;
  readonly DEVICE_DATA_TABLE_NAME: string;
  readonly RAW_AMBYTE_DATA_TABLE_NAME: string;
  readonly MACRO_DATA_TABLE_NAME: string;

  constructor(
    private readonly jobsService: DatabricksJobsService,
    private readonly queryBuilder: QueryBuilderService,
    private readonly sqlService: DatabricksSqlService,
    private readonly filesService: DatabricksFilesService,
    private readonly configService: DatabricksConfigService,
  ) {
    this.CATALOG_NAME = this.configService.getCatalogName();
    this.CENTRUM_SCHEMA_NAME = this.configService.getCentrumSchemaName();
    this.RAW_DATA_TABLE_NAME = this.configService.getRawDataTableName();
    this.DEVICE_DATA_TABLE_NAME = this.configService.getDeviceDataTableName();
    this.RAW_AMBYTE_DATA_TABLE_NAME = this.configService.getRawAmbyteDataTableName();
    this.MACRO_DATA_TABLE_NAME = this.configService.getMacroDataTableName();
  }

  async healthCheck(): Promise<Result<DatabricksHealthCheck>> {
    return this.jobsService.healthCheck();
  }

  async triggerAmbyteProcessingJob(
    params: Record<string, string>,
  ): Promise<Result<DatabricksJobRunResponse>> {
    this.logger.log({
      msg: "Triggering ambyte processing job",
      operation: "triggerAmbyteProcessingJob",
      experimentId: params.EXPERIMENT_ID,
    });

    const jobParams = {
      ...params,
      CATALOG_NAME: this.configService.getCatalogName(),
    };

    const jobId = this.configService.getAmbyteProcessingJobIdAsNumber();
    return this.jobsService.triggerJob(jobId, jobParams);
  }

  async triggerDataExportJob(
    experimentId: string,
    tableName: string,
    format: string,
    userId: string,
  ): Promise<Result<DatabricksJobRunResponse>> {
    const jobParams = {
      EXPERIMENT_ID: experimentId,
      TABLE_NAME: tableName,
      FORMAT: format,
      USER_ID: userId,
      CATALOG_NAME: this.configService.getCatalogName(),
    };

    const jobId = this.configService.getDataExportJobIdAsNumber();
    return this.jobsService.triggerJob(jobId, jobParams);
  }

  async streamExport(
    exportId: string,
    experimentId: string,
  ): Promise<Result<{ stream: Readable; filePath: string; tableName: string }>> {
    this.logger.log({
      msg: "Streaming export by ID",
      operation: "streamExport",
      exportId,
      experimentId,
    });

    const queryResult = this.queryBuilder.buildQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.experiment_export_metadata`,
      whereConditions: [
        ["export_id", exportId],
        ["experiment_id", experimentId],
      ],
      limit: 1,
    });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    const metadataResult = await this.executeSqlQuery(this.CENTRUM_SCHEMA_NAME, queryResult.value);

    if (metadataResult.isFailure()) {
      return metadataResult;
    }

    const schemaData = metadataResult.value;

    if (schemaData.rows.length === 0) {
      this.logger.warn({
        msg: "Export not found",
        operation: "streamExport",
        exportId,
      });
      return failure(AppError.notFound("Export not found"));
    }

    const filePathIndex = schemaData.columns.findIndex((col) => col.name === "file_path");
    const tableNameIndex = schemaData.columns.findIndex((col) => col.name === "table_name");
    const filePath = schemaData.rows[0][filePathIndex];
    const tableName = schemaData.rows[0][tableNameIndex];

    if (!filePath) {
      this.logger.error({
        msg: "Export has no file path",
        operation: "streamExport",
        exportId,
      });
      return failure(AppError.internal("Export file path is missing"));
    }

    if (!tableName) {
      this.logger.error({
        msg: "Export has no table name",
        operation: "streamExport",
        exportId,
      });
      return failure(AppError.internal("Export table name is missing"));
    }

    const downloadResult = await this.filesService.download(filePath);

    if (downloadResult.isFailure()) {
      return downloadResult;
    }

    return success({
      stream: downloadResult.value,
      filePath,
      tableName,
    });
  }

  async getExportMetadata(experimentId: string, tableName: string): Promise<Result<SchemaData>> {
    this.logger.log({
      msg: "Fetching completed exports from Delta Lake",
      operation: "getExportMetadata",
      experimentId,
      tableName,
    });

    const queryResult = this.queryBuilder.buildQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.experiment_export_metadata`,
      whereConditions: [
        ["experiment_id", experimentId],
        ["table_name", tableName],
      ],
      orderBy: "created_at",
      orderDirection: "DESC",
    });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    const completedResult = await this.executeSqlQuery(this.CENTRUM_SCHEMA_NAME, queryResult.value);

    if (completedResult.isFailure()) {
      return failure(completedResult.error);
    }

    this.logger.log({
      msg: "Completed exports fetched successfully",
      operation: "getExportMetadata",
      experimentId,
      tableName,
      count: completedResult.value.rows.length,
    });

    return completedResult;
  }

  async getActiveExports(
    experimentId: string,
    tableName: string,
  ): Promise<Result<ExportMetadata[]>> {
    this.logger.log({
      msg: "Fetching active exports from job runs",
      operation: "getActiveExports",
      experimentId,
      tableName,
    });

    const jobId = this.configService.getDataExportJobIdAsNumber();

    const runsResult = await this.jobsService.listRunsForJob(jobId, true);

    if (runsResult.isFailure()) {
      return failure(runsResult.error);
    }

    const runs = runsResult.value.runs ?? [];

    const activeExports = runs.reduce<ExportMetadata[]>((acc, run) => {
      const paramsArray = run.job_parameters ?? [];
      const params: Record<string, string> = paramsArray.reduce((record, param) => {
        record[param.name] = param.value;
        return record;
      }, {});

      if (params.EXPERIMENT_ID !== experimentId || params.TABLE_NAME !== tableName) {
        return acc;
      }

      const lifecycleState = run.state.life_cycle_state;
      let status: ExportMetadata["status"];
      switch (lifecycleState) {
        case JobLifecycleState.QUEUED:
          status = "queued";
          break;
        case JobLifecycleState.PENDING:
          status = "pending";
          break;
        case JobLifecycleState.RUNNING:
        case JobLifecycleState.TERMINATING:
          status = "running";
          break;
        case JobLifecycleState.INTERNAL_ERROR:
          // Platform-level error, not caught by getFailedExports()
          status = "failed";
          break;
        default:
          // active_only should not return TERMINATED or SKIPPED
          return acc;
      }

      acc.push({
        exportId: null,
        experimentId: params.EXPERIMENT_ID,
        tableName: params.TABLE_NAME,
        format: params.FORMAT as "csv" | "ndjson" | "json-array" | "parquet",
        status,
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: params.USER_ID || "",
        createdAt: new Date(run.start_time).toISOString(),
        completedAt: run.end_time ? new Date(run.end_time).toISOString() : null,
        jobRunId: run.run_id,
      });

      return acc;
    }, []);

    return success(activeExports);
  }

  async getFailedExports(
    experimentId: string,
    tableName: string,
    completedExportRunIds: Set<number>,
  ): Promise<Result<ExportMetadata[]>> {
    this.logger.log({
      msg: "Fetching failed exports from completed job runs",
      operation: "getFailedExports",
      experimentId,
      tableName,
    });

    const jobId = this.configService.getDataExportJobIdAsNumber();

    const runsResult = await this.jobsService.listRunsForJob(jobId, false, 25, true);

    if (runsResult.isFailure()) {
      return failure(runsResult.error);
    }

    const runs = runsResult.value.runs ?? [];

    const failedExports = runs.reduce<ExportMetadata[]>((acc, run) => {
      // Skip runs already represented by a completed export record in Delta Lake
      if (completedExportRunIds.has(run.run_id)) {
        return acc;
      }

      const paramsArray = run.job_parameters ?? [];
      const params: Record<string, string> = paramsArray.reduce(
        (record: Record<string, string>, param) => {
          record[param.name] = param.value;
          return record;
        },
        {},
      );

      if (params.EXPERIMENT_ID !== experimentId || params.TABLE_NAME !== tableName) {
        return acc;
      }

      const resultState = run.state.result_state;
      if (
        run.state.life_cycle_state !== JobLifecycleState.TERMINATED ||
        resultState === JobResultState.SUCCESS
      ) {
        return acc;
      }

      acc.push({
        exportId: null,
        experimentId: params.EXPERIMENT_ID,
        tableName: params.TABLE_NAME,
        format: params.FORMAT as "csv" | "ndjson" | "json-array" | "parquet",
        status: "failed",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: params.USER_ID || "",
        createdAt: new Date(run.start_time).toISOString(),
        completedAt: run.end_time ? new Date(run.end_time).toISOString() : null,
        jobRunId: run.run_id,
      });

      return acc;
    }, []);

    return success(failedExports);
  }

  /**
   * Read row counts and (optionally) schemas from the experiment_table_metadata
   * cache table in a single query.
   */
  async getExperimentTableMetadata(
    experimentId: string,
    options?: {
      identifier?: string;
      includeSchemas?: boolean;
    },
  ): Promise<Result<ExperimentTableMetadata[]>> {
    const catalog = this.configService.getCatalogName();
    const schema = this.configService.getCentrumSchemaName();

    const includeSchemas = options?.includeSchemas !== false;
    const columns = includeSchemas
      ? [
          "identifier",
          "table_type",
          "row_count",
          "macro_schema",
          "questions_schema",
          "custom_metadata_schema",
        ]
      : ["identifier", "table_type", "row_count"];

    const whereConditions: [string, string][] = [["experiment_id", experimentId]];
    if (options?.identifier) {
      whereConditions.push(["identifier", options.identifier]);
    }

    const queryResult = this.queryBuilder.buildQuery({
      table: `${catalog}.${schema}.experiment_table_metadata`,
      columns,
      whereConditions,
    });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    this.logger.debug({
      msg: "Querying experiment table metadata",
      operation: "getExperimentTableMetadata",
      experimentId,
      identifier: options?.identifier,
      includeSchemas,
    });

    const result = await this.sqlService.executeSqlQuery(schema, queryResult.value);

    if (result.isFailure()) {
      return failure(result.error);
    }

    if (!("rows" in result.value)) {
      return failure(AppError.internal("Invalid query result format", "INVALID_QUERY_RESULT"));
    }

    const metadata = result.value.rows.map((row) => {
      const base = {
        // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
        identifier: row[0] as string,
        tableType: (row[1] ?? "static") as "static" | "macro",
        rowCount: row[2] ? parseInt(row[2], 10) : 0,
      };

      if (includeSchemas) {
        return {
          ...base,
          macroSchema: row[3],
          questionsSchema: row[4],
          customMetadataSchema: row[5],
        };
      }

      return base;
    });

    return success(metadata);
  }

  /**
   * Build a SQL query for experiment data, dispatching to static vs macro table.
   */
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
  }): Result<string> {
    const {
      tableName,
      tableType,
      experimentId,
      columns,
      variants,
      exceptColumns,
      filters,
      aggregation,
      distinct,
      orderBy,
      orderDirection,
      limit,
      offset,
    } = params;

    const catalog = this.configService.getCatalogName();
    const schema = this.configService.getCentrumSchemaName();

    if (tableType === "macro") {
      // Macro tables share a single physical table, filtered by experiment_id and macro_id
      const table = `${catalog}.${schema}.${this.MACRO_DATA_TABLE_NAME}`;
      const whereConditions: [string, string][] = [
        ["experiment_id", experimentId],
        ["macro_id", tableName],
      ];

      return this.queryBuilder.buildQuery({
        table,
        columns,
        variants,
        exceptColumns,
        whereConditions,
        filters,
        aggregation,
        distinct,
        orderBy,
        orderDirection,
        limit,
        offset,
      });
    }

    const staticTableMapping: Record<string, string> = {
      [ExperimentTableName.RAW_DATA]: this.RAW_DATA_TABLE_NAME,
      [ExperimentTableName.DEVICE]: this.DEVICE_DATA_TABLE_NAME,
      [ExperimentTableName.RAW_AMBYTE_DATA]: this.RAW_AMBYTE_DATA_TABLE_NAME,
    };

    const physicalTable = staticTableMapping[tableName];
    if (!physicalTable) {
      return failure(
        AppError.internal(
          `No physical table mapping found for static table '${tableName}'`,
          "UNKNOWN_TABLE_MAPPING",
        ),
      );
    }
    const table = `${catalog}.${schema}.${physicalTable}`;
    const whereConditions: [string, string][] = [["experiment_id", experimentId]];

    return this.queryBuilder.buildQuery({
      table,
      columns,
      variants,
      exceptColumns,
      whereConditions,
      filters,
      aggregation,
      distinct,
      orderBy,
      orderDirection,
      limit,
      offset,
    });
  }

  async executeSqlQuery(schemaName: string, sqlStatement: string): Promise<Result<SchemaData>> {
    this.logger.debug({
      msg: "Executing SQL query",
      operation: "executeSqlQuery",
      schemaName,
    });
    return this.sqlService.executeSqlQuery(schemaName, sqlStatement);
  }

  /**
   * Upload to /Volumes/{catalog}/{schema}/data-imports/{experimentId}/{sourceType}/{dir}/{file}.
   */
  async uploadExperimentData(
    schemaName: string,
    experimentId: string,
    sourceType: string,
    directoryName: string,
    fileName: string,
    fileBuffer: Buffer,
  ): Promise<Result<UploadFileResponse>> {
    const catalogName = this.configService.getCatalogName();

    const filePath = `/Volumes/${catalogName}/${schemaName}/data-imports/${experimentId}/${sourceType}/${directoryName}/${fileName}`;

    return this.filesService.upload(filePath, fileBuffer);
  }
}
