import { Injectable, Logger } from "@nestjs/common";
import { Readable } from "stream";

import { ExperimentTableName, zExperimentUploadSourceKind } from "@repo/api/domains/experiment/experiment.schema";

import type {
  ExportFormat,
  ExportMetadata,
} from "../../../experiments/core/models/experiment-data-exports.model";
import type { UploadMetadata } from "../../../experiments/core/models/experiment-data-uploads.model";
import type { ExperimentTableMetadata } from "../../../experiments/core/models/experiment-data.model";
import { DatabricksPort as ExperimentDatabricksPort } from "../../../experiments/core/ports/databricks.port";
import type { DataUploadJobInput } from "../../../experiments/core/ports/databricks.port";
import { Result, success, failure, AppError } from "../../utils/fp-utils";
import { DatabricksConfigService } from "./services/config/config.service";
import { DatabricksFilesService } from "./services/files/files.service";
import type { UploadFileResponse } from "./services/files/files.types";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import type { DatabricksHealthCheck } from "./services/jobs/jobs.types";
import type { DatabricksJobRunResponse } from "./services/jobs/jobs.types";
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
  readonly MACRO_DATA_TABLE_NAME: string;
  readonly UPLOADED_DATA_TABLE_NAME: string;

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
    this.MACRO_DATA_TABLE_NAME = this.configService.getMacroDataTableName();
    this.UPLOADED_DATA_TABLE_NAME = this.configService.getUploadedDataTableName();
  }

  async healthCheck(): Promise<Result<DatabricksHealthCheck>> {
    return this.jobsService.healthCheck();
  }

  /**
   * Trigger the data upload Databricks job. Accepts semantic input and maps to
   * the per-kind widget keys the Python task reads via dbutils.widgets.get(...).
   */
  async triggerDataUploadJob(input: DataUploadJobInput): Promise<Result<DatabricksJobRunResponse>> {
    this.logger.log({
      msg: "Triggering data upload job",
      operation: "triggerDataUploadJob",
      experimentId: input.experimentId,
      sourceKind: input.sourceKind,
      uploadId: "uploadId" in input ? input.uploadId : undefined,
      uploadTableName: "uploadTableName" in input ? input.uploadTableName : undefined,
    });

    const jobParams: Record<string, string> = {
      SOURCE_KIND: input.sourceKind,
      EXPERIMENT_ID: input.experimentId,
      UPLOAD_DIRECTORY: input.uploadDirectory,
      UPLOAD_ID: input.uploadId,
      USER_ID: input.userId,
      CATALOG_NAME: this.configService.getCatalogName(),
    };
    jobParams.UPLOAD_TABLE_ID = input.uploadTableId;
    jobParams.UPLOAD_TABLE_NAME = input.uploadTableName;
    if (input.sourceKind === "ambyte") {
      jobParams.EXPERIMENT_NAME = input.experimentName;
      // Year prefix tracks the calendar year of upload — used to partition the
      // ambyte volume layout. Sourced from the system clock so it never goes stale.
      jobParams.YEAR_PREFIX = new Date().getUTCFullYear().toString();
    }

    const jobId = this.configService.getDataUploadJobIdAsNumber();
    return this.jobsService.triggerJob(jobId, jobParams);
  }

  /** Run status for any Databricks job by runId. */
  async getJobRunStatus(runId: number) {
    return this.jobsService.getJobRunStatus(runId);
  }

  /**
   * Trigger the data export job. Booleans are stringified because Databricks
   * job widgets are string-only on the wire; the PySpark task parses them back.
   */
  async triggerDataExportJob(
    experimentId: string,
    tableName: string,
    format: string,
    userId: string,
    anonymizeContributors: boolean,
  ): Promise<Result<DatabricksJobRunResponse>> {
    const jobParams = {
      EXPERIMENT_ID: experimentId,
      TABLE_NAME: tableName,
      FORMAT: format,
      USER_ID: userId,
      CATALOG_NAME: this.configService.getCatalogName(),
      ANONYMIZE_CONTRIBUTORS: anonymizeContributors ? "true" : "false",
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
    const jobId = this.configService.getDataExportJobIdAsNumber();
    const runsResult = await this.jobsService.listActiveRunsWithParams(jobId);
    if (runsResult.isFailure()) {
      return failure(runsResult.error);
    }

    const exports: ExportMetadata[] = [];
    for (const { run, params, status } of runsResult.value) {
      if (params.EXPERIMENT_ID !== experimentId || params.TABLE_NAME !== tableName) {
        continue;
      }
      if (!params.USER_ID) {
        continue;
      }
      exports.push({
        exportId: null,
        experimentId: params.EXPERIMENT_ID,
        tableName: params.TABLE_NAME,
        format: params.FORMAT as ExportFormat,
        status,
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: params.USER_ID,
        createdAt: new Date(run.start_time).toISOString(),
        completedAt: run.end_time ? new Date(run.end_time).toISOString() : null,
        jobRunId: run.run_id,
      });
    }
    return success(exports);
  }

  async getFailedExports(
    experimentId: string,
    tableName: string,
    completedExportRunIds: Set<number>,
  ): Promise<Result<ExportMetadata[]>> {
    const jobId = this.configService.getDataExportJobIdAsNumber();
    const runsResult = await this.jobsService.listFailedRunsWithParams(
      jobId,
      completedExportRunIds,
    );
    if (runsResult.isFailure()) {
      return failure(runsResult.error);
    }

    const exports: ExportMetadata[] = [];
    for (const { run, params } of runsResult.value) {
      if (params.EXPERIMENT_ID !== experimentId || params.TABLE_NAME !== tableName) {
        continue;
      }
      if (!params.USER_ID) {
        continue;
      }
      exports.push({
        exportId: null,
        experimentId: params.EXPERIMENT_ID,
        tableName: params.TABLE_NAME,
        format: params.FORMAT as ExportFormat,
        status: "failed",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: params.USER_ID,
        createdAt: new Date(run.start_time).toISOString(),
        completedAt: run.end_time ? new Date(run.end_time).toISOString() : null,
        jobRunId: run.run_id,
      });
    }
    return success(exports);
  }

  /**
   * Get completed upload metadata for an experiment from the Delta history table.
   */
  async getUploadMetadata(
    experimentId: string,
    options?: { uploadTableId?: string; uploadTableName?: string },
  ): Promise<Result<SchemaData>> {
    const whereConditions: [string, string][] = [["experiment_id", experimentId]];
    if (options?.uploadTableId) {
      whereConditions.push(["upload_table_id", options.uploadTableId]);
    }
    if (options?.uploadTableName) {
      whereConditions.push(["upload_table_name", options.uploadTableName]);
    }
    const queryResult = this.queryBuilder.buildQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.experiment_upload_metadata`,
      whereConditions,
      orderBy: "created_at",
      orderDirection: "DESC",
    });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    return this.executeSqlQuery(this.CENTRUM_SCHEMA_NAME, queryResult.value);
  }

  /**
   * Get active (in-progress) uploads for an experiment by querying the data upload job runs.
   * Filters job-runs API by EXPERIMENT_ID widget (and optionally UPLOAD_TABLE_ID / UPLOAD_TABLE_NAME).
   */
  async getActiveUploads(
    experimentId: string,
    options?: { uploadTableId?: string; uploadTableName?: string },
  ): Promise<Result<UploadMetadata[]>> {
    const jobId = this.configService.getDataUploadJobIdAsNumber();
    const runsResult = await this.jobsService.listActiveRunsWithParams(jobId);
    if (runsResult.isFailure()) {
      return failure(runsResult.error);
    }

    const uploads: UploadMetadata[] = [];
    for (const { run, params, status } of runsResult.value) {
      if (params.EXPERIMENT_ID !== experimentId) {
        continue;
      }
      if (options?.uploadTableId && params.UPLOAD_TABLE_ID !== options.uploadTableId) {
        continue;
      }
      if (options?.uploadTableName && params.UPLOAD_TABLE_NAME !== options.uploadTableName) {
        continue;
      }
      if (!params.UPLOAD_ID || !params.USER_ID) {
        continue;
      }
      const parsedKind = zExperimentUploadSourceKind.safeParse(params.SOURCE_KIND);
      if (!parsedKind.success) {
        continue;
      }
      uploads.push({
        uploadId: params.UPLOAD_ID,
        experimentId: params.EXPERIMENT_ID,
        uploadTableId: params.UPLOAD_TABLE_ID || null,
        uploadTableName: params.UPLOAD_TABLE_NAME || null,
        sourceKind: parsedKind.data,
        // Upload history doesn't surface "queued" separately; collapse into "pending".
        status: status === "queued" ? "pending" : status,
        fileCount: null,
        rowCount: null,
        createdBy: params.USER_ID,
        createdAt: new Date(run.start_time).toISOString(),
        completedAt: run.end_time ? new Date(run.end_time).toISOString() : null,
        errorMessage: null,
      });
    }
    return success(uploads);
  }

  /**
   * Get failed uploads from completed job runs (terminated + non-SUCCESS),
   * deduped against the set of upload_ids already in the Delta history table.
   */
  async getFailedUploads(
    experimentId: string,
    completedUploadIds: Set<string>,
    options?: { uploadTableId?: string; uploadTableName?: string },
  ): Promise<Result<UploadMetadata[]>> {
    const jobId = this.configService.getDataUploadJobIdAsNumber();
    // Pass an empty run-id set: dedup happens by UPLOAD_ID below since the
    // upload metadata table keys on it, not on the Databricks run id.
    const runsResult = await this.jobsService.listFailedRunsWithParams(jobId, new Set());
    if (runsResult.isFailure()) {
      return failure(runsResult.error);
    }

    const uploads: UploadMetadata[] = [];
    for (const { run, params } of runsResult.value) {
      if (params.EXPERIMENT_ID !== experimentId) {
        continue;
      }
      if (options?.uploadTableId && params.UPLOAD_TABLE_ID !== options.uploadTableId) {
        continue;
      }
      if (options?.uploadTableName && params.UPLOAD_TABLE_NAME !== options.uploadTableName) {
        continue;
      }
      if (!params.UPLOAD_ID || !params.USER_ID) {
        continue;
      }
      if (completedUploadIds.has(params.UPLOAD_ID)) {
        continue;
      }
      const parsedKind = zExperimentUploadSourceKind.safeParse(params.SOURCE_KIND);
      if (!parsedKind.success) {
        continue;
      }
      uploads.push({
        uploadId: params.UPLOAD_ID,
        experimentId: params.EXPERIMENT_ID,
        uploadTableId: params.UPLOAD_TABLE_ID || null,
        uploadTableName: params.UPLOAD_TABLE_NAME || null,
        sourceKind: parsedKind.data,
        status: "failed",
        fileCount: null,
        rowCount: null,
        createdBy: params.USER_ID,
        createdAt: new Date(run.start_time).toISOString(),
        completedAt: run.end_time ? new Date(run.end_time).toISOString() : null,
        errorMessage: null,
      });
    }
    return success(uploads);
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
          "display_name",
          "row_count",
          "macro_schema",
          "questions_schema",
          "custom_metadata_schema",
          "upload_schema",
        ]
      : ["identifier", "table_type", "display_name", "row_count"];

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

    const metadata: ExperimentTableMetadata[] = result.value.rows.map((row) => {
      // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
      const identifier = row[0] as string;
      const tableType = (row[1] ?? "static") as "static" | "macro" | "upload";
      const displayName = row[2] ?? null;
      const rowCount = row[3] ? parseInt(row[3], 10) : 0;

      if (includeSchemas) {
        return {
          identifier,
          tableType,
          displayName,
          rowCount,
          macroSchema: row[4],
          questionsSchema: row[5],
          customMetadataSchema: row[6],
          uploadSchema: row[7],
        };
      }

      return { identifier, tableType, displayName, rowCount };
    });

    return success(metadata);
  }

  /**
   * Build a SQL query for experiment data, dispatching to static vs macro table.
   */
  buildExperimentQuery(params: {
    tableName: string;
    tableType: "static" | "macro" | "upload";
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

    if (tableType === "upload") {
      // Upload tables: query the gold experiment_uploaded_data, filter by experiment_id AND
      // upload_table_id. `tableName` here is the stable upload_table_id passed by the caller.
      const table = `${catalog}.${schema}.${this.UPLOADED_DATA_TABLE_NAME}`;
      const whereConditions: [string, string][] = [
        ["experiment_id", experimentId],
        ["upload_table_id", tableName],
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
    body: Buffer | NodeJS.ReadableStream,
  ): Promise<Result<UploadFileResponse>> {
    const catalogName = this.configService.getCatalogName();

    const filePath = `/Volumes/${catalogName}/${schemaName}/data-imports/${experimentId}/${sourceType}/${directoryName}/${fileName}`;

    return this.filesService.upload(filePath, body);
  }
}
