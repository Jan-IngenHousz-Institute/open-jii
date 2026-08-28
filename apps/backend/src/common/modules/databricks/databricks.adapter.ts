import { Injectable, Logger } from "@nestjs/common";
import { Readable } from "stream";

import { ExperimentTableName } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { zExperimentUploadSourceKind } from "@repo/api/domains/experiment/experiment.schema";

import type {
  ExportFormat,
  ExportMetadata,
} from "../../../experiments/core/models/experiment-data-exports.model";
import type { UploadMetadata } from "../../../experiments/core/models/experiment-data-uploads.model";
import type { ExperimentTableMetadata } from "../../../experiments/core/models/experiment-data.model";
import { DatabricksPort as ExperimentDatabricksPort } from "../../../experiments/core/ports/databricks.port";
import type { DataUploadJobInput } from "../../../experiments/core/ports/databricks.port";
import type { DeviceLifecycleEventRow } from "../../../iot/core/models/device-lifecycle-event.model";
import type {
  DeviceBatteryRow,
  DeviceFirmwareVersionRow,
  DeviceMacroRow,
  DeviceMeasurementRow,
  DevicePayloadBreakdownRow,
  DeviceThroughputRow,
  GroupExperimentRow,
  GroupFirmwareRow,
  GroupLifecycleEventRow,
  GroupThroughputRow,
} from "../../../iot/core/ports/databricks.port";
import type {
  ActivityWindowsRow,
  ContributorPairRow,
  DailyActivityRow,
  FamilyTotalsRow,
  HourlyActivityRow,
  ParameterCategory,
  ParameterStatsRow,
  PlatformTotalsRow,
  PoolFactsRow,
  ScopedDailyRow,
} from "../../../metrics/core/ports/databricks.port";
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
  QueryParams,
} from "./services/query-builder/query-builder.types";
import { DatabricksSqlService } from "./services/sql/sql.service";
import type { SchemaData } from "./services/sql/sql.types";

@Injectable()
export class DatabricksAdapter implements ExperimentDatabricksPort {
  private readonly logger = new Logger(DatabricksAdapter.name);

  readonly CATALOG_NAME: string;
  readonly CENTRUM_SCHEMA_NAME: string;
  readonly METRICS_SCHEMA_NAME: string;

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
    this.METRICS_SCHEMA_NAME = this.configService.getMetricsSchemaName();
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
      // Year prefix tracks the calendar year of upload, partitioning the ambyte
      // volume layout. Sourced from the system clock so it never goes stale.
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
  ): Promise<
    Result<{ stream: Readable; filePath: string; tableName: string; completedAt: string | null }>
  > {
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
    const completedAtIndex = schemaData.columns.findIndex((col) => col.name === "completed_at");
    const filePath = schemaData.rows[0][filePathIndex];
    const tableName = schemaData.rows[0][tableNameIndex];
    const completedAt = completedAtIndex >= 0 ? schemaData.rows[0][completedAtIndex] : null;

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
      completedAt: completedAt ?? null,
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

  /** Last data arrival from gold device_last_activity; lags by pipeline cadence. */
  async getDeviceLastActivity(thingName: string): Promise<Result<{ lastDataAt: string | null }>> {
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.device_last_activity`,
      whereConditions: [["client_id", thingName]],
      limit: 1,
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    const firstRow = rows.at(0);

    return success({
      lastDataAt: firstRow === undefined ? null : this.toIsoOrNull(firstRow[index.last_data_at]),
    });
  }

  /** Batched last data arrival, keyed by thing name; absent rows mean no data yet. */
  async getDevicesLastActivity(thingNames: string[]): Promise<Result<Map<string, string | null>>> {
    if (thingNames.length === 0) {
      return success(new Map());
    }
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.device_last_activity`,
      columns: ["client_id", "last_data_at"],
      filters: [{ column: "client_id", operator: "in", value: thingNames }],
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    const activity = new Map<string, string | null>();
    for (const row of rows) {
      const clientId = row[index.client_id];
      if (clientId !== null) {
        activity.set(clientId, this.toIsoOrNull(row[index.last_data_at]));
      }
    }
    return success(activity);
  }

  /** Batched measurement volume per (bucket, thing) for a group of things. */
  async getDevicesThroughput(
    thingNames: string[],
    from: string,
    to: string,
    bucket: "hour" | "day",
    limit: number,
  ): Promise<Result<GroupThroughputRow[]>> {
    if (thingNames.length === 0) {
      return success([]);
    }
    const bucketAlias = `timestamp_${bucket}`;
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_data`,
      filters: [
        { column: "client_id", operator: "in", value: thingNames },
        { column: "timestamp", operator: "between", value: [from, to] },
      ],
      aggregation: {
        groupBy: [{ column: "timestamp", timeBucket: bucket }, { column: "client_id" }],
        functions: [{ column: "*", function: "count", alias: "measurement_count" }],
      },
      orderBy: bucketAlias,
      orderDirection: "ASC",
      limit,
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        bucketStart: this.toIsoOrNull(row[index[bucketAlias]]),
        clientId: row[index.client_id] ?? null,
        count: Number(row[index.measurement_count] ?? 0),
      })),
    );
  }

  /** Measurement volume per (bucket, experiment) aggregated across a group. */
  async getDevicesDataByExperiment(
    thingNames: string[],
    from: string,
    to: string,
    bucket: "hour" | "day",
    limit: number,
  ): Promise<Result<GroupExperimentRow[]>> {
    if (thingNames.length === 0) {
      return success([]);
    }
    const bucketAlias = `timestamp_${bucket}`;
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_data`,
      filters: [
        { column: "client_id", operator: "in", value: thingNames },
        { column: "timestamp", operator: "between", value: [from, to] },
      ],
      aggregation: {
        groupBy: [{ column: "timestamp", timeBucket: bucket }, { column: "experiment_id" }],
        functions: [{ column: "*", function: "count", alias: "measurement_count" }],
      },
      orderBy: bucketAlias,
      orderDirection: "ASC",
      limit,
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        bucketStart: this.toIsoOrNull(row[index[bucketAlias]]),
        experimentId: row[index.experiment_id] ?? null,
        count: Number(row[index.measurement_count] ?? 0),
      })),
    );
  }

  /** Firmware versions seen per thing in the window, with last sighting. */
  async getDevicesFirmware(
    thingNames: string[],
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<GroupFirmwareRow[]>> {
    if (thingNames.length === 0) {
      return success([]);
    }
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_data`,
      filters: [
        { column: "client_id", operator: "in", value: thingNames },
        { column: "timestamp", operator: "between", value: [from, to] },
      ],
      aggregation: {
        groupBy: [{ column: "client_id" }, { column: "device_version" }],
        functions: [{ column: "timestamp", function: "max", alias: "last_seen" }],
      },
      // Newest sightings first, so a hit ceiling can only shed stale rows.
      orderBy: "last_seen",
      orderDirection: "DESC",
      limit,
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        clientId: row[index.client_id] ?? null,
        version: row[index.device_version] ?? null,
        lastSeen: this.toIsoOrNull(row[index.last_seen]),
      })),
    );
  }

  /**
   * Latest lifecycle events across a group of things, newest first. `limit`
   * caps the whole group after ordering, deliberately: this feeds a merged
   * log, so a reconnect-storming member may fill the window it dominates.
   */
  async getDevicesLifecycleEvents(
    thingNames: string[],
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<GroupLifecycleEventRow[]>> {
    if (thingNames.length === 0) {
      return success([]);
    }
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_device_lifecycle_events`,
      columns: ["client_id", "event_type", "event_timestamp", "disconnect_reason"],
      filters: [
        { column: "client_id", operator: "in", value: thingNames },
        { column: "event_timestamp", operator: "between", value: [from, to] },
      ],
      orderBy: "event_timestamp",
      orderDirection: "DESC",
      limit,
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        clientId: row[index.client_id] ?? null,
        eventType: row[index.event_type] ?? null,
        eventTimestamp: this.toIsoOrNull(row[index.event_timestamp]),
        disconnectReason: row[index.disconnect_reason] ?? null,
      })),
    );
  }

  /** Lifecycle events in a range, ascending, capped at `limit`. */
  async getDeviceLifecycleEvents(
    thingName: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<DeviceLifecycleEventRow[]>> {
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_device_lifecycle_events`,
      columns: ["event_type", "event_timestamp", "disconnect_reason", "session_identifier"],
      whereConditions: [["client_id", thingName]],
      filters: [{ column: "event_timestamp", operator: "between", value: [from, to] }],
      orderBy: "event_timestamp",
      orderDirection: "ASC",
      limit,
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        eventType: row[index.event_type] ?? null,
        eventTimestamp: this.toIsoOrNull(row[index.event_timestamp]),
        disconnectReason: row[index.disconnect_reason] ?? null,
        sessionIdentifier: row[index.session_identifier] ?? null,
      })),
    );
  }

  /** Measurement counts per time bucket and experiment. */
  async getDeviceThroughput(
    thingName: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceThroughputRow[]>> {
    const bucketAlias = `timestamp_${bucket}`;
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_data`,
      whereConditions: [["client_id", thingName]],
      filters: [{ column: "timestamp", operator: "between", value: [from, to] }],
      aggregation: {
        groupBy: [{ column: "timestamp", timeBucket: bucket }, { column: "experiment_id" }],
        functions: [{ column: "*", function: "count", alias: "measurement_count" }],
      },
      orderBy: bucketAlias,
      orderDirection: "ASC",
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        bucketStart: this.toIsoOrNull(row[index[bucketAlias]]),
        experimentId: row[index.experiment_id] ?? null,
        count: Number(row[index.measurement_count] ?? 0),
      })),
    );
  }

  /** Average reported battery per bucket; AVG skips nulls, so a battery-less bucket is null. */
  async getDeviceBatterySeries(
    thingName: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceBatteryRow[]>> {
    const bucketAlias = `timestamp_${bucket}`;
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_data`,
      whereConditions: [["client_id", thingName]],
      filters: [{ column: "timestamp", operator: "between", value: [from, to] }],
      aggregation: {
        groupBy: [{ column: "timestamp", timeBucket: bucket }],
        functions: [{ column: "device_battery", function: "avg", alias: "average_battery" }],
      },
      orderBy: bucketAlias,
      orderDirection: "ASC",
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => {
        const raw = row[index.average_battery];
        return {
          bucketStart: this.toIsoOrNull(row[index[bucketAlias]]),
          averageBattery: raw === null ? null : Number(raw),
        };
      }),
    );
  }

  /**
   * One grouped scan powering the payload profile. COUNT(column) skips nulls,
   * which is what makes the coverage counts work.
   */
  async getDevicePayloadBreakdown(
    thingName: string,
    from: string,
    to: string,
  ): Promise<Result<DevicePayloadBreakdownRow[]>> {
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_data`,
      whereConditions: [["client_id", thingName]],
      filters: [{ column: "timestamp", operator: "between", value: [from, to] }],
      aggregation: {
        groupBy: [
          { column: "device_version" },
          { column: "protocol_id" },
          { column: "workbook_version_id" },
          { column: "workbook_run_id" },
        ],
        functions: [
          { column: "*", function: "count", alias: "row_count" },
          { column: "latitude", function: "count", alias: "gps_count" },
          { column: "device_battery", function: "count", alias: "battery_count" },
        ],
      },
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        deviceVersion: row[index.device_version] ?? null,
        protocolId: row[index.protocol_id] ?? null,
        workbookVersionId: row[index.workbook_version_id] ?? null,
        workbookRunId: row[index.workbook_run_id] ?? null,
        count: Number(row[index.row_count] ?? 0),
        withGps: Number(row[index.gps_count] ?? 0),
        withBattery: Number(row[index.battery_count] ?? 0),
      })),
    );
  }

  /**
   * Counts per macro. `macros` is an array per measurement, so rows are
   * exploded before grouping and counts can exceed the measurement total.
   */
  async getDeviceMacroBreakdown(
    thingName: string,
    from: string,
    to: string,
  ): Promise<Result<DeviceMacroRow[]>> {
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_data`,
      whereConditions: [["client_id", thingName]],
      filters: [{ column: "timestamp", operator: "between", value: [from, to] }],
      aggregation: {
        explode: { column: "macros", alias: "macro" },
        groupBy: [{ column: "macro.id", alias: "macro_id" }],
        functions: [{ column: "*", function: "count", alias: "row_count" }],
      },
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        macroId: row[index.macro_id] ?? null,
        count: Number(row[index.row_count] ?? 0),
      })),
    );
  }

  /**
   * Reported firmware per (time bucket, version): grouping by version alone
   * would collapse a rollback into two overlapping windows.
   */
  async getDeviceFirmwareHistory(
    thingName: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceFirmwareVersionRow[]>> {
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_data`,
      whereConditions: [["client_id", thingName]],
      filters: [{ column: "timestamp", operator: "between", value: [from, to] }],
      aggregation: {
        groupBy: [{ column: "timestamp", timeBucket: bucket }, { column: "device_version" }],
        functions: [
          { column: "timestamp", function: "min", alias: "first_seen" },
          { column: "timestamp", function: "max", alias: "last_seen" },
          { column: "*", function: "count", alias: "row_count" },
        ],
      },
      orderBy: "first_seen",
      orderDirection: "ASC",
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        version: row[index.device_version] ?? null,
        firstSeen: this.toIsoOrNull(row[index.first_seen]),
        lastSeen: this.toIsoOrNull(row[index.last_seen]),
        count: Number(row[index.row_count] ?? 0),
      })),
    );
  }

  /** Most recent measurements in a range, newest first. */
  async getDeviceRecentMeasurements(
    thingName: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<DeviceMeasurementRow[]>> {
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_data`,
      columns: [
        "timestamp",
        "experiment_id",
        "protocol_id",
        "workbook_version_id",
        "device_version",
        "device_battery",
        "latitude",
        "longitude",
        "sample",
      ],
      whereConditions: [["client_id", thingName]],
      filters: [{ column: "timestamp", operator: "between", value: [from, to] }],
      orderBy: "timestamp",
      orderDirection: "DESC",
      limit,
    });
    if (result.isFailure()) {
      return failure(result.error);
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        timestamp: this.toIsoOrNull(row[index.timestamp]),
        experimentId: row[index.experiment_id] ?? null,
        protocolId: row[index.protocol_id] ?? null,
        workbookVersionId: row[index.workbook_version_id] ?? null,
        deviceVersion: row[index.device_version] ?? null,
        battery: this.toNumberOrNull(row[index.device_battery]),
        latitude: this.toNumberOrNull(row[index.latitude]),
        longitude: this.toNumberOrNull(row[index.longitude]),
        // Device-defined shape, so it travels as the stored JSON text.
        sample: row[index.sample] ?? null,
      })),
    );
  }

  private toNumberOrNull(raw: string | null | undefined): number | null {
    if (raw === null || raw === undefined) {
      return null;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Build the SQL, run it against the centrum schema, index columns by name.
  private async runMonitoringQuery(
    params: QueryParams,
  ): Promise<Result<{ rows: (string | null)[][]; index: Record<string, number> }>> {
    const queryResult = this.queryBuilder.buildQuery(params);
    if (queryResult.isFailure()) {
      return failure(queryResult.error);
    }

    const result = await this.executeSqlQuery(this.CENTRUM_SCHEMA_NAME, queryResult.value);
    if (result.isFailure()) {
      return failure(result.error);
    }

    return success({ rows: result.value.rows, index: this.columnIndex(result.value.columns) });
  }

  private columnIndex(columns: { name: string }[]): Record<string, number> {
    const index: Record<string, number> = {};
    columns.forEach((column, i) => {
      index[column.name] = i;
    });
    return index;
  }

  private toIsoOrNull(raw: string | null | undefined): string | null {
    if (!raw) {
      return null;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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

  private metricsTable(tableName: string): string {
    return `${this.CATALOG_NAME}.${this.METRICS_SCHEMA_NAME}.${tableName}`;
  }

  private async readMetricsTable(
    tableName: string,
    options: {
      orderBy?: string;
      orderDirection?: "ASC" | "DESC";
      limit?: number;
      filters?: FilterCondition[];
    } = {},
  ): Promise<Result<{ rows: (string | null)[][]; index: Record<string, number> }>> {
    const queryResult = this.queryBuilder.buildQuery({
      table: this.metricsTable(tableName),
      ...options,
    });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    const result = await this.executeSqlQuery(this.METRICS_SCHEMA_NAME, queryResult.value);
    if (result.isFailure()) {
      return result;
    }

    return success({ rows: result.value.rows, index: this.columnIndex(result.value.columns) });
  }

  async getPublicPlatformTotals(): Promise<Result<PlatformTotalsRow | null>> {
    const result = await this.readMetricsTable("platform_totals", { limit: 1 });
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    if (rows.length === 0) {
      return success(null);
    }

    const row = rows[0];
    return success({
      totalMeasurements: Number(row[index.total_measurements] ?? 0),
      totalUploadedRows: Number(row[index.total_uploaded_rows] ?? 0),
      totalMacroExecutions: Number(row[index.total_macro_executions] ?? 0),
      devicesAllTime: Number(row[index.devices_all_time] ?? 0),
      experimentsWithData: Number(row[index.experiments_with_data] ?? 0),
      firstMeasurementAt: row[index.first_measurement_at] ?? null,
      lastMeasurementAt: row[index.last_measurement_at] ?? null,
      computedAt: row[index.computed_at] ?? null,
    });
  }

  async getPublicDailyActivity(days: number): Promise<Result<DailyActivityRow[]>> {
    const result = await this.readMetricsTable("daily_activity", {
      orderBy: "date",
      orderDirection: "DESC",
      limit: days,
    });
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    const mapped = rows.map((row) => ({
      date: String(row[index.date]),
      measurements: Number(row[index.measurements] ?? 0),
      cumulativeMeasurements: Number(row[index.cumulative_measurements] ?? 0),
      volumeBytes: Number(row[index.volume_bytes] ?? 0),
    }));

    return success(mapped.reverse());
  }

  async getPublicFamilyTotals(): Promise<Result<FamilyTotalsRow[]>> {
    const result = await this.readMetricsTable("family_totals", {
      orderBy: "total_measurements",
      orderDirection: "DESC",
    });
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        family: String(row[index.family]),
        measurements: Number(row[index.total_measurements] ?? 0),
      })),
    );
  }

  async getActivityWindows(): Promise<Result<ActivityWindowsRow | null>> {
    const result = await this.readMetricsTable("activity_windows", { limit: 1 });
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    if (rows.length === 0) {
      return success(null);
    }

    const row = rows[0];
    return success({
      measurements24h: Number(row[index.measurements_24h] ?? 0),
      measurements30d: Number(row[index.measurements_30d] ?? 0),
      experiments30d: Number(row[index.experiments_30d] ?? 0),
      contributors30d: Number(row[index.contributors_30d] ?? 0),
      devices30d: Number(row[index.devices_30d] ?? 0),
      lastMeasurementAt: row[index.last_measurement_at] ?? null,
      computedAt: row[index.computed_at] ?? null,
    });
  }

  async getHourlyActivity(): Promise<Result<HourlyActivityRow[]>> {
    const result = await this.readMetricsTable("hourly_activity", {
      orderBy: "hour_local",
      orderDirection: "ASC",
    });
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        hourLocal: Number(row[index.hour_local] ?? 0),
        measurements: Number(row[index.measurements] ?? 0),
      })),
    );
  }

  async getTopParameter(category: ParameterCategory): Promise<Result<ParameterStatsRow | null>> {
    const result = await this.readMetricsTable("parameter_stats", {
      filters: [{ column: "category", operator: "equals", value: category }],
      orderBy: "count_30d",
      orderDirection: "DESC",
      limit: 1,
    });
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    if (rows.length === 0) {
      return success(null);
    }

    const row = rows[0];
    return success({
      name: String(row[index.parameter]),
      count30d: Number(row[index.count_30d] ?? 0),
      median: Number(row[index.median_value] ?? 0),
    });
  }

  async getPoolFacts(): Promise<Result<PoolFactsRow | null>> {
    const result = await this.readMetricsTable("pool_facts", { limit: 1 });
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    if (rows.length === 0) {
      return success(null);
    }

    const row = rows[0];
    return success({
      sessionMedianMeasurements: this.toNumberOrNull(row[index.session_median_measurements]),
      deviceEnduranceDays: this.toNumberOrNull(row[index.device_endurance_days]),
      simultaneityPeakDevices: this.toNumberOrNull(row[index.simultaneity_peak_devices]),
      timezonesAllTime: this.toNumberOrNull(row[index.timezones_all_time]),
      timezonesPeakDay: this.toNumberOrNull(row[index.timezones_peak_day]),
    });
  }

  async getScopedDailyActivity(days: number): Promise<Result<ScopedDailyRow[]>> {
    // Inclusive BETWEEN: today plus days-1 back covers exactly `days` dates.
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const asDate = (value: Date) => value.toISOString().slice(0, 10);

    const result = await this.readMetricsTable("daily_activity_by_experiment", {
      filters: [{ column: "date", operator: "between", value: [asDate(from), asDate(to)] }],
      orderBy: "date",
      orderDirection: "ASC",
    });
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        date: String(row[index.date]),
        experimentId: String(row[index.experiment_id]),
        measurements: Number(row[index.measurements] ?? 0),
      })),
    );
  }

  async getContributorPairs(): Promise<Result<ContributorPairRow[]>> {
    const result = await this.readMetricsTable("experiment_contributors_window", {});
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    return success(
      rows.map((row) => ({
        experimentId: String(row[index.experiment_id]),
        userId: String(row[index.user_id]),
      })),
    );
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
