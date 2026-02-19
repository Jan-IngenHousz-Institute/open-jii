import { Injectable, Logger } from "@nestjs/common";
import { Readable } from "stream";

import { ExperimentTableName } from "@repo/api";

import type { ExportMetadata } from "../../../experiments/core/models/experiment-data-exports.model";
import { DatabricksPort as ExperimentDatabricksPort } from "../../../experiments/core/ports/databricks.port";
import type { MacroDto } from "../../../macros/core/models/macro.model";
import { DatabricksPort as MacrosDatabricksPort } from "../../../macros/core/ports/databricks.port";
import { ErrorCodes } from "../../utils/error-codes";
import { Result, success, failure, AppError } from "../../utils/fp-utils";
import { DatabricksConfigService } from "./services/config/config.service";
import { DatabricksFilesService } from "./services/files/files.service";
import type { UploadFileResponse } from "./services/files/files.types";
import { DatabricksJobsService } from "./services/jobs/jobs.service";
import type { DatabricksHealthCheck } from "./services/jobs/jobs.types";
import type { DatabricksJobRunResponse } from "./services/jobs/jobs.types";
import { JobLifecycleState, JobResultState } from "./services/jobs/jobs.types";
import { QueryBuilderService } from "./services/query-builder/query-builder.service";
import { DatabricksSqlService } from "./services/sql/sql.service";
import type { SchemaData } from "./services/sql/sql.types";
import { DatabricksWorkspaceService } from "./services/workspace/workspace.service";
import type {
  ImportWorkspaceObjectResponse,
  DeleteWorkspaceObjectResponse,
} from "./services/workspace/workspace.types";
import { WorkspaceObjectFormat } from "./services/workspace/workspace.types";

export interface ExperimentTableMetadata {
  tableName: string;
  rowCount: number;
  macroSchema?: string | null;
  questionsSchema?: string | null;
}
@Injectable()
export class DatabricksAdapter implements ExperimentDatabricksPort, MacrosDatabricksPort {
  private readonly logger = new Logger(DatabricksAdapter.name);

  // Schema and catalog names exposed to repository
  readonly CATALOG_NAME: string;
  readonly CENTRUM_SCHEMA_NAME: string;

  // Physical Databricks table names exposed to repository
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
    private readonly workspaceService: DatabricksWorkspaceService,
  ) {
    this.CATALOG_NAME = this.configService.getCatalogName();
    this.CENTRUM_SCHEMA_NAME = this.configService.getCentrumSchemaName();
    this.RAW_DATA_TABLE_NAME = this.configService.getRawDataTableName();
    this.DEVICE_DATA_TABLE_NAME = this.configService.getDeviceDataTableName();
    this.RAW_AMBYTE_DATA_TABLE_NAME = this.configService.getRawAmbyteDataTableName();
    this.MACRO_DATA_TABLE_NAME = this.configService.getMacroDataTableName();
  }

  /**
   * Check if the Databricks service is available and responding
   */
  async healthCheck(): Promise<Result<DatabricksHealthCheck>> {
    return this.jobsService.healthCheck();
  }

  /**
   * Trigger the ambyte processing Databricks job with the specified parameters
   */
  async triggerAmbyteProcessingJob(
    params: Record<string, string>,
  ): Promise<Result<DatabricksJobRunResponse>> {
    this.logger.log({
      msg: "Triggering ambyte processing job",
      operation: "triggerAmbyteProcessingJob",
      experimentId: params.EXPERIMENT_ID,
    });

    // Add catalog name to params
    const jobParams = {
      ...params,
      CATALOG_NAME: this.configService.getCatalogName(),
    };

    const jobId = this.configService.getAmbyteProcessingJobIdAsNumber();
    return this.jobsService.triggerJob(jobId, jobParams);
  }

  /**
   * Trigger the data export Databricks job with the specified parameters
   * @param experimentId - The experiment ID
   * @param tableName - The table name to export
   * @param format - The export format (csv, ndjson, json-array, parquet)
   * @param userId - User ID who initiated the export
   * @returns Result containing the job run response
   */
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

  /**
   * Stream an export file by export ID
   * Fetches metadata, validates status, and streams the file
   * @param exportId - The export ID
   * @param experimentId - The experiment ID (for additional validation)
   * @returns Result containing a readable stream and file path
   */
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

    // Fetch export metadata using query builder (select all columns)
    const query = this.queryBuilder.buildQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.experiment_export_metadata`,
      whereConditions: [
        ["export_id", exportId],
        ["experiment_id", experimentId],
      ],
      limit: 1,
    });

    const metadataResult = await this.executeSqlQuery(this.CENTRUM_SCHEMA_NAME, query);

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

    // Parse file path and table name from query result
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

    // Stream the file
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

  /**
   * Get completed export metadata for an experiment and table from Delta Lake
   * Returns raw SchemaData from the database query
   * @param experimentId - The experiment ID
   * @param tableName - The table name
   * @returns Result containing raw SchemaData with export records
   */
  async getExportMetadata(experimentId: string, tableName: string): Promise<Result<SchemaData>> {
    this.logger.log({
      msg: "Fetching completed exports from Delta Lake",
      operation: "getExportMetadata",
      experimentId,
      tableName,
    });

    const query = this.queryBuilder.buildQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.experiment_export_metadata`,
      whereConditions: [
        ["experiment_id", experimentId],
        ["table_name", tableName],
      ],
      orderBy: "created_at",
      orderDirection: "DESC",
    });

    const completedResult = await this.executeSqlQuery(this.CENTRUM_SCHEMA_NAME, query);

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

  /**
   * Get active (in-progress) exports for an experiment by querying job runs
   * Filters active job runs by experiment_id and table_name parameters
   * @param experimentId - The experiment ID to filter by
   * @param tableName - The table name to filter by
   * @returns Result containing array of ExportMetadata for active exports
   */
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

    // Get active job runs for the export job
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
          // Skip runs with unexpected lifecycle states
          // (active_only should not return TERMINATED or SKIPPED)
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

  /**
   * Get failed exports for an experiment by querying completed job runs
   * Filters completed job runs that have a non-SUCCESS result state
   * @param experimentId - The experiment ID to filter by
   * @param tableName - The table name to filter by
   * @param completedExportRunIds - Set of job run IDs already present in completed exports (to avoid duplicates)
   * @returns Result containing array of ExportMetadata for failed exports
   */
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

    // Get completed (terminated) job runs for the export job
    const runsResult = await this.jobsService.listRunsForJob(jobId, false, 25, true);

    if (runsResult.isFailure()) {
      return failure(runsResult.error);
    }

    const runs = runsResult.value.runs ?? [];

    const failedExports = runs.reduce<ExportMetadata[]>((acc, run) => {
      // Skip runs that already have a completed export record in Delta Lake
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

      // Only include runs that terminated with a non-success result
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
   * Upload macro code file to Databricks workspace
   * Uses the pre-computed filename and adds appropriate file extension based on the language
   * @param params - The macro filename, code, and language to upload
   * @returns Result containing the import response
   */
  async uploadMacroCode({
    filename,
    code,
    language,
  }: Pick<MacroDto, "filename" | "code" | "language">): Promise<
    Result<ImportWorkspaceObjectResponse>
  > {
    // Determine file extension based on language
    let fileExtension: string | undefined;
    switch (language) {
      case "python":
        fileExtension = ".py";
        break;
      case "r":
        fileExtension = ".r";
        break;
      case "javascript":
        fileExtension = ".js";
        break;
      default:
        fileExtension = undefined;
    }

    const fileName = fileExtension ? `${filename}${fileExtension}` : filename;

    this.logger.log({
      msg: "Uploading macro code",
      operation: "uploadMacroCode",
      filename,
      language,
      fileName,
    });

    // Construct the workspace path for the macro
    const workspacePath = `/Shared/macros/${fileName}`;

    // Upload the macro code to Databricks workspace
    return await this.workspaceService.importWorkspaceObject({
      content: code,
      format: WorkspaceObjectFormat.RAW,
      overwrite: true,
      path: workspacePath,
    });
  }

  /**
   * Delete macro code from Databricks workspace
   * Uses the pre-computed filename directly
   * @param filename - The filename of the macro to delete
   * @returns Result containing the delete response
   */
  async deleteMacroCode(filename: string): Promise<Result<DeleteWorkspaceObjectResponse>> {
    this.logger.log({
      msg: "Deleting macro code",
      operation: "deleteMacroCode",
      filename,
    });

    // Construct the workspace path for the macro - we need to determine the extension
    // For now, we'll try common extensions (this could be improved by storing extension separately)
    const extensions = [".py", ".r", ".js", ""];

    for (const ext of extensions) {
      const workspacePath = `/Shared/macros/${filename}${ext}`;

      const deleteResult = await this.workspaceService.deleteWorkspaceObject({
        path: workspacePath,
        recursive: false,
      });

      // If deletion was successful or file was not found, we're done
      if (deleteResult.isSuccess()) {
        this.logger.log({
          msg: "Successfully deleted macro",
          operation: "deleteMacroCode",
          workspacePath,
          status: "success",
        });
        return deleteResult;
      }

      // If it's not a "not found" error, return the error
      if (!deleteResult.error.message.includes("does not exist")) {
        return deleteResult;
      }
    }

    // If we get here, the file wasn't found with any extension
    this.logger.warn({
      msg: "Macro file not found",
      errorCode: ErrorCodes.DATABRICKS_FILE_FAILED,
      operation: "deleteMacroCode",
      filename,
    });
    return this.workspaceService.deleteWorkspaceObject({
      path: `/Shared/macros/${filename}`,
      recursive: false,
    });
  }

  /**
   * Get consolidated experiment table metadata (row counts and schemas) from the
   * experiment_table_metadata cache table. This is a single-query optimization
   * that replaces multiple separate queries.
   *
   * Returns metadata for all tables in an experiment:
   * - Raw data table (logical name: 'raw_data')
   * - Device data table (logical name: 'device')
   * - Ambyte data table (logical name: 'raw_ambyte_data')
   * - All macro tables (one per macro_filename, uses macro_name as display name)
   *
   * @param experimentId - The experiment identifier
   * @param options - Optional configuration
   * @param options.tableName - If provided, only return metadata for this specific table (logical name or macro name)
   * @param options.includeSchemas - If false, exclude macro_schema and questions_schema columns (default: true)
   * @returns Result containing array of table metadata with schemas and row counts
   */
  async getExperimentTableMetadata(
    experimentId: string,
    options?: {
      tableName?: string;
      includeSchemas?: boolean;
    },
  ): Promise<Result<ExperimentTableMetadata[]>> {
    const catalog = this.configService.getCatalogName();
    const schema = this.configService.getCentrumSchemaName();

    const includeSchemas = options?.includeSchemas !== false; // Default to true
    const columns = includeSchemas
      ? ["table_name", "row_count", "macro_schema", "questions_schema"]
      : ["table_name", "row_count"];

    const whereConditions: [string, string][] = [["experiment_id", experimentId]];
    if (options?.tableName) {
      whereConditions.push(["table_name", options.tableName]);
    }

    const query = this.queryBuilder.buildQuery({
      table: `${catalog}.${schema}.experiment_table_metadata`,
      columns,
      whereConditions,
    });

    this.logger.debug({
      msg: "Querying experiment table metadata",
      operation: "getExperimentTableMetadata",
      experimentId,
      tableName: options?.tableName,
      includeSchemas,
    });

    const result = await this.sqlService.executeSqlQuery(schema, query);

    if (result.isFailure()) {
      return failure(result.error);
    }

    // Transform rows into structured data
    if (!("rows" in result.value)) {
      return failure(AppError.internal("Invalid query result format", "INVALID_QUERY_RESULT"));
    }

    const metadata = result.value.rows.map((row) => {
      const base = {
        // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
        tableName: row[0] as string,
        rowCount: row[1] ? parseInt(row[1], 10) : 0,
      };

      if (includeSchemas) {
        return {
          ...base,
          macroSchema: row[2],
          questionsSchema: row[3],
        };
      }

      return base;
    });

    return success(metadata);
  }

  /**
   * Build a SQL query for experiment data with optional VARIANT parsing
   * Automatically handles both simple SELECT and VARIANT parsing based on variants parameter
   */
  buildExperimentQuery(params: {
    tableName: string;
    experimentId: string;
    columns?: string[];
    variants?: { columnName: string; schema: string }[];
    exceptColumns?: string[];
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  }): string {
    const {
      tableName,
      experimentId,
      columns,
      variants,
      exceptColumns,
      orderBy,
      orderDirection,
      limit,
      offset,
    } = params;

    const catalog = this.configService.getCatalogName();
    const schema = this.configService.getCentrumSchemaName();

    // Map table names to their corresponding physical tables
    const tableMapping: Record<string, string> = {
      [ExperimentTableName.RAW_DATA]: this.RAW_DATA_TABLE_NAME,
      [ExperimentTableName.DEVICE]: this.DEVICE_DATA_TABLE_NAME,
      [ExperimentTableName.RAW_AMBYTE_DATA]: this.RAW_AMBYTE_DATA_TABLE_NAME,
    };

    const targetTable = tableMapping[tableName];
    const table = targetTable
      ? `${catalog}.${schema}.${targetTable}`
      : `${catalog}.${schema}.${this.MACRO_DATA_TABLE_NAME}`;

    // For known physical tables, filter by experiment_id only
    // For macros, filter by experiment_id AND macro_filename
    const whereConditions: [string, string][] = targetTable
      ? [["experiment_id", experimentId]]
      : [
          ["experiment_id", experimentId],
          ["macro_filename", tableName],
        ];

    return this.queryBuilder.buildQuery({
      table,
      columns,
      variants,
      exceptColumns,
      whereConditions,
      orderBy,
      orderDirection,
      limit,
      offset,
    });
  }

  /**
   * Execute a SQL query in a specific schema.
   * Uses INLINE disposition and JSON_ARRAY format.
   */
  async executeSqlQuery(schemaName: string, sqlStatement: string): Promise<Result<SchemaData>> {
    this.logger.debug({
      msg: "Executing SQL query",
      operation: "executeSqlQuery",
      schemaName,
    });
    return this.sqlService.executeSqlQuery(schemaName, sqlStatement);
  }

  /**
   * Upload a file to Databricks for a specific experiment.
   * Constructs the path: /Volumes/{catalogName}/{schemaName}/data-imports/{sourceType}/{directoryName}/{fileName}
   *
   * @param schemaName - Schema name of the experiment
   * @param sourceType - Type of data source (e.g., 'ambyte')
   * @param directoryName - Unique directory name for this upload session
   * @param fileName - Name of the file
   * @param fileBuffer - File contents as a buffer
   * @returns Result containing the upload response
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

    // Construct the full path with experiment_id subdirectory
    const filePath = `/Volumes/${catalogName}/${schemaName}/data-imports/${experimentId}/${sourceType}/${directoryName}/${fileName}`;

    return this.filesService.upload(filePath, fileBuffer);
  }
}
