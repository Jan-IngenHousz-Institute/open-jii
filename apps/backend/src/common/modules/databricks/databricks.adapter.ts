import { Injectable, Logger } from "@nestjs/common";

import { ExperimentTableName } from "@repo/api/domains/experiment/data/experiment-data.schema";

import type { ExperimentTableMetadata } from "../../../experiments/core/models/experiment-data.model";
import { DatabricksPort as ExperimentDatabricksPort } from "../../../experiments/core/ports/databricks.port";
import type {
  DataExportJobInput,
  DataUploadJobInput,
} from "../../../experiments/core/ports/databricks.port";
import type { DatabricksPort as HealthDatabricksPort } from "../../../health/core/ports/databricks.port";
import type { DeviceLifecycleEventRow } from "../../../iot/core/models/device-lifecycle-event.model";
import type {
  DeviceBatteryRow,
  DeviceFirmwareVersionRow,
  DeviceMacroRow,
  DeviceMeasurementRow,
  DevicePayloadBreakdownRow,
  DeviceThroughputRow,
  ExperimentDeviceSeriesRow,
  ExperimentDeviceStatsRow,
  ExperimentPublisherRow,
  GroupExperimentRow,
  GroupFirmwareRow,
  GroupLifecycleEventRow,
  GroupThroughputRow,
} from "../../../iot/core/ports/databricks.port";
import type {
  ActivityWindowsRow,
  ContributorPairRow,
  DevicePairRow,
  DailyActivityRow,
  FamilyTotalsRow,
  HourlyActivityRow,
  ParameterCategory,
  ParameterStatsRow,
  ResourceDailyRow,
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
import { cellNumber, cellString, cellUtcIso } from "./services/sql/cell-values";
import { DatabricksSqlService } from "./services/sql/sql.service";
import type { SchemaData, StatementParameter } from "./services/sql/sql.types";

@Injectable()
export class DatabricksAdapter implements ExperimentDatabricksPort, HealthDatabricksPort {
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
      uploadId: input.uploadId,
      uploadTableName: input.uploadTableName,
    });

    const jobParams: Record<string, string> = {
      SOURCE_KIND: input.sourceKind,
      EXPERIMENT_ID: input.experimentId,
      UPLOAD_DIRECTORY: input.uploadDirectory,
      UPLOAD_ID: input.uploadId,
      USER_ID: input.userId,
      CATALOG_NAME: this.configService.getCatalogName(),
      UPLOAD_TABLE_ID: input.uploadTableId,
      UPLOAD_TABLE_NAME: input.uploadTableName,
    };
    if (input.sourceKind === "ambyte") {
      jobParams.EXPERIMENT_NAME = input.experimentName;
      // The year the upload was recorded, not the clock's, so a re-trigger from the stored
      // record sends the same parameters as the first.
      jobParams.YEAR_PREFIX = input.createdAt.getUTCFullYear().toString();
    }

    const jobId = this.configService.getDataUploadJobIdAsNumber();
    return this.jobsService.triggerJob(jobId, jobParams, input.uploadId);
  }

  /** Run status for any Databricks job by runId. */
  async getJobRunStatus(runId: number) {
    return this.jobsService.getJobRunStatus(runId);
  }

  /** Output of one task run, which carries a failed notebook's error. */
  async getJobRunOutput(taskRunId: number) {
    return this.jobsService.getJobRunOutput(taskRunId);
  }

  /**
   * Trigger the data export job. Booleans are stringified because Databricks
   * job widgets are string-only on the wire; the PySpark task parses them back.
   */
  async triggerDataExportJob(input: DataExportJobInput): Promise<Result<DatabricksJobRunResponse>> {
    const jobParams = {
      EXPORT_ID: input.exportId,
      EXPERIMENT_ID: input.experimentId,
      TABLE_NAME: input.tableName,
      FORMAT: input.format,
      USER_ID: input.userId,
      CATALOG_NAME: this.configService.getCatalogName(),
      ANONYMIZE_CONTRIBUTORS: input.anonymizeContributors ? "true" : "false",
    };

    const jobId = this.configService.getDataExportJobIdAsNumber();
    return this.jobsService.triggerJob(jobId, jobParams, input.exportId);
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

  /**
   * The configured device serving view adds measurement counts to the latest
   * device attributes.
   */
  async getExperimentDeviceStats(
    experimentId: string,
    limit: number,
  ): Promise<Result<ExperimentDeviceStatsRow[]>> {
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.${this.DEVICE_DATA_TABLE_NAME}`,
      columns: [
        "client_id",
        "device_name",
        "device_firmware",
        "device_version",
        "device_battery",
        "total_measurements",
        "processed_timestamp",
      ],
      whereConditions: [["experiment_id", experimentId]],
      orderBy: "processed_timestamp",
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
        deviceName: row[index.device_name] ?? null,
        firmware: row[index.device_firmware] ?? null,
        version: row[index.device_version] ?? null,
        battery: this.toNumberOrNull(row[index.device_battery]),
        totalMeasurements: Number(row[index.total_measurements] ?? 0),
        lastReportedAt: this.toIsoOrNull(row[index.processed_timestamp]),
      })),
    );
  }

  /**
   * Every client id that published into one experiment in the window, with
   * volume and last arrival. Newest publishers first, so a hit ceiling can
   * only shed the ones that went quiet earliest.
   */
  async getExperimentPublishers(
    experimentId: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<ExperimentPublisherRow[]>> {
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_data`,
      whereConditions: [["experiment_id", experimentId]],
      filters: [{ column: "timestamp", operator: "between", value: [from, to] }],
      aggregation: {
        groupBy: [{ column: "client_id" }],
        functions: [
          { column: "*", function: "count", alias: "measurement_count" },
          { column: "timestamp", function: "max", alias: "last_data_at" },
        ],
      },
      orderBy: "last_data_at",
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
        count: Number(row[index.measurement_count] ?? 0),
        lastDataAt: this.toIsoOrNull(row[index.last_data_at]),
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

  /** Scoped on both keys, so it never returns traffic into other experiments. */
  async getExperimentDeviceSeries(
    experimentId: string,
    clientId: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<ExperimentDeviceSeriesRow[]>> {
    const bucketAlias = `timestamp_${bucket}`;
    const result = await this.runMonitoringQuery({
      table: `${this.CATALOG_NAME}.${this.CENTRUM_SCHEMA_NAME}.clean_data`,
      whereConditions: [
        ["experiment_id", experimentId],
        ["client_id", clientId],
      ],
      filters: [{ column: "timestamp", operator: "between", value: [from, to] }],
      aggregation: {
        groupBy: [{ column: "timestamp", timeBucket: bucket }],
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
        count: Number(row[index.measurement_count] ?? 0),
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
   * Read row counts and (optionally) schemas from the experiment_table_metadata
   * view in a single query. The view counts rows when read, so counts are current.
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
          "latest_row_at",
          "schema_revision",
          "macro_schema",
          "questions_schema",
          "custom_metadata_schema",
          "upload_schema",
        ]
      : [
          "identifier",
          "table_type",
          "display_name",
          "row_count",
          "latest_row_at",
          "schema_revision",
        ];

    const whereConditions: [string, string][] = [["experiment_id", experimentId]];
    if (options?.identifier) {
      whereConditions.push(["identifier", options.identifier]);
    }

    const queryResult = this.queryBuilder.buildQuery({
      table: `${catalog}.${schema}.experiment_table_metadata_view`,
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
      const latestRowAt = this.toIsoOrNull(row[4]);
      const schemaRevision = row[5] ?? null;

      if (includeSchemas) {
        return {
          identifier,
          tableType,
          displayName,
          rowCount,
          latestRowAt,
          schemaRevision,
          macroSchema: row[6],
          questionsSchema: row[7],
          customMetadataSchema: row[8],
          uploadSchema: row[9],
        };
      }

      return { identifier, tableType, displayName, rowCount, latestRowAt, schemaRevision };
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
    variants?: { columnName: string; schema: string; suffix?: string }[];
    reservedColumns?: string[];
    exceptColumns?: string[];
    filters?: FilterCondition[];
    aggregation?: AggregationSpec;
    distinct?: boolean;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    orderByContributorPseudonymSalt?: string;
    limit?: number;
    offset?: number;
  }): Result<string> {
    const { tableName, tableType, experimentId, ...query } = params;

    const tableResult = this.experimentTable(tableType, tableName);
    if (tableResult.isFailure()) {
      return tableResult;
    }

    // Macro and upload tables each share one physical table; `tableName` is then the macro_id or
    // the stable upload_table_id passed by the caller.
    const whereConditions: [string, string][] = [["experiment_id", experimentId]];
    if (tableType === "macro") {
      whereConditions.push(["macro_id", tableName]);
    }
    if (tableType === "upload") {
      whereConditions.push(["upload_table_id", tableName]);
    }

    return this.queryBuilder.buildQuery({ ...query, table: tableResult.value, whereConditions });
  }

  /** Column names of the view an experiment table reads from, in its own order. */
  async getExperimentTableColumns(
    tableType: "static" | "macro" | "upload",
    tableName: string,
  ): Promise<Result<string[]>> {
    const tableResult = this.experimentTable(tableType, tableName);
    if (tableResult.isFailure()) {
      return tableResult;
    }

    const described = await this.executeSqlQuery(
      this.CENTRUM_SCHEMA_NAME,
      `DESCRIBE TABLE ${tableResult.value}`,
    );
    if (described.isFailure()) {
      return described;
    }

    // Partition and detail sections follow the columns, after a blank or `#` row.
    const names = described.value.rows.map(([name]) => name ?? "");
    const sectionEnd = names.findIndex((name) => name === "" || name.startsWith("#"));
    return success(sectionEnd === -1 ? names : names.slice(0, sectionEnd));
  }

  private experimentTable(
    tableType: "static" | "macro" | "upload",
    tableName: string,
  ): Result<string> {
    const catalog = this.configService.getCatalogName();
    const schema = this.configService.getCentrumSchemaName();

    if (tableType === "macro") {
      return success(`${catalog}.${schema}.${this.MACRO_DATA_TABLE_NAME}`);
    }
    if (tableType === "upload") {
      return success(`${catalog}.${schema}.${this.UPLOADED_DATA_TABLE_NAME}`);
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
    return success(`${catalog}.${schema}.${physicalTable}`);
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
      aggregation?: AggregationSpec;
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

    // A truncated result would silently under-report aggregates.
    if (result.value.truncated) {
      return failure(AppError.internal(`Metrics read of ${tableName} was truncated`));
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
    const totalMeasurements = cellNumber(row[index.total_measurements]);
    if (totalMeasurements === null) {
      return success(null);
    }

    return success({
      totalMeasurements,
      totalVolumeBytes: cellNumber(row[index.total_volume_bytes]) ?? 0,
      totalUploadedRows: cellNumber(row[index.total_uploaded_rows]) ?? 0,
      totalMacroExecutions: cellNumber(row[index.total_macro_executions]) ?? 0,
      devicesAllTime: cellNumber(row[index.devices_all_time]) ?? 0,
      experimentsWithData: cellNumber(row[index.experiments_with_data]) ?? 0,
      firstMeasurementAt: cellUtcIso(row[index.first_measurement_at]),
      lastMeasurementAt: cellUtcIso(row[index.last_measurement_at]),
      computedAt: cellUtcIso(row[index.computed_at]),
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
    const mapped = rows
      .map((row) => ({
        date: cellString(row[index.date]),
        measurements: cellNumber(row[index.measurements]),
        cumulativeMeasurements: cellNumber(row[index.cumulative_measurements]),
        volumeBytes: cellNumber(row[index.volume_bytes]),
      }))
      .filter(
        (row): row is DailyActivityRow =>
          row.date !== null &&
          row.measurements !== null &&
          row.cumulativeMeasurements !== null &&
          row.volumeBytes !== null,
      );

    this.warnDroppedMetricsRows("daily_activity", rows.length - mapped.length);
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
    const mapped = rows
      .map((row) => ({
        family: cellString(row[index.family]),
        measurements: cellNumber(row[index.total_measurements]),
      }))
      .filter((row): row is FamilyTotalsRow => row.family !== null && row.measurements !== null);

    this.warnDroppedMetricsRows("family_totals", rows.length - mapped.length);
    return success(mapped);
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
    const measurements24h = cellNumber(row[index.measurements_24h]);
    const measurements30d = cellNumber(row[index.measurements_30d]);
    const experiments30d = cellNumber(row[index.experiments_30d]);
    const contributors30d = cellNumber(row[index.contributors_30d]);
    if (
      measurements24h === null ||
      measurements30d === null ||
      experiments30d === null ||
      contributors30d === null
    ) {
      return success(null);
    }

    return success({
      measurements24h,
      measurements30d,
      experiments30d,
      contributors30d,
      devices30d: cellNumber(row[index.devices_30d]) ?? 0,
      lastMeasurementAt: cellUtcIso(row[index.last_measurement_at]),
      computedAt: cellUtcIso(row[index.computed_at]),
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
    const mapped = rows
      .map((row) => ({
        hourLocal: cellNumber(row[index.hour_local]),
        measurements: cellNumber(row[index.measurements]),
      }))
      .filter(
        (row): row is HourlyActivityRow =>
          row.hourLocal !== null &&
          Number.isInteger(row.hourLocal) &&
          row.hourLocal >= 0 &&
          row.hourLocal <= 23 &&
          row.measurements !== null,
      );

    this.warnDroppedMetricsRows("hourly_activity", rows.length - mapped.length);
    return success(mapped);
  }

  async getTopParameter(category: ParameterCategory): Promise<Result<ParameterStatsRow | null>> {
    const result = await this.readMetricsTable("parameter_stats", {
      filters: [{ column: "category", operator: "equals", value: category }],
      orderBy: "observations",
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
    const name = cellString(row[index.parameter]);
    const label = cellString(row[index.label]) ?? name;
    const observations = cellNumber(row[index.observations]);
    const median = cellNumber(row[index.median_value]);
    if (name === null || observations === null || median === null) {
      return success(null);
    }

    return success({ label: label ?? name, name, observations, median });
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
      sessionMedianMeasurements: cellNumber(row[index.session_median_measurements]),
      meanArrivalGapSeconds: cellNumber(row[index.mean_arrival_gap_seconds]),
      currentStreakDays: cellNumber(row[index.current_streak_days]),
      deviceEnduranceDays: cellNumber(row[index.device_endurance_days]),
      simultaneityPeakDevices: cellNumber(row[index.simultaneity_peak_devices]),
      timezonesAllTime: cellNumber(row[index.timezones_all_time]),
      timezonesPeakDay: cellNumber(row[index.timezones_peak_day]),
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
    const mapped = rows
      .map((row) => ({
        date: cellString(row[index.date]),
        experimentId: cellString(row[index.experiment_id]),
        measurements: cellNumber(row[index.measurements]),
      }))
      .filter(
        (row): row is ScopedDailyRow =>
          row.date !== null && row.experimentId !== null && row.measurements !== null,
      );

    this.warnDroppedMetricsRows("daily_activity_by_experiment", rows.length - mapped.length);
    return success(mapped);
  }

  async getResourceDailyActivity(
    resourceType: string,
    days: number,
  ): Promise<Result<ResourceDailyRow[]>> {
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const asDate = (value: Date) => value.toISOString().slice(0, 10);

    const result = await this.readMetricsTable("daily_activity_by_resource", {
      filters: [
        { column: "resource_type", operator: "equals", value: resourceType },
        { column: "date", operator: "between", value: [asDate(from), asDate(to)] },
      ],
      orderBy: "date",
      orderDirection: "ASC",
    });
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    const mapped = rows
      .map((row) => ({
        date: cellString(row[index.date]),
        resourceType: cellString(row[index.resource_type]),
        resourceId: cellString(row[index.resource_id]),
        measurements: cellNumber(row[index.measurements]),
      }))
      .filter(
        (row): row is ResourceDailyRow =>
          row.date !== null &&
          row.resourceType !== null &&
          row.resourceId !== null &&
          row.measurements !== null,
      );

    this.warnDroppedMetricsRows("daily_activity_by_resource", rows.length - mapped.length);
    return success(mapped);
  }

  async getContributorPairs(): Promise<Result<ContributorPairRow[]>> {
    const result = await this.readMetricsTable("experiment_contributors_window", {});
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    const mapped = rows
      .map((row) => ({
        experimentId: cellString(row[index.experiment_id]),
        userId: cellString(row[index.user_id]),
      }))
      .filter((row): row is ContributorPairRow => row.experimentId !== null && row.userId !== null);

    this.warnDroppedMetricsRows("experiment_contributors_window", rows.length - mapped.length);
    return success(mapped);
  }

  async getDevicePairs(): Promise<Result<DevicePairRow[]>> {
    const result = await this.readMetricsTable("experiment_devices_window", {});
    if (result.isFailure()) {
      return result;
    }

    const { rows, index } = result.value;
    const mapped = rows
      .map((row) => ({
        experimentId: cellString(row[index.experiment_id]),
        clientId: cellString(row[index.client_id]),
      }))
      .filter((row): row is DevicePairRow => row.experimentId !== null && row.clientId !== null);

    this.warnDroppedMetricsRows("experiment_devices_window", rows.length - mapped.length);
    return success(mapped);
  }

  private warnDroppedMetricsRows(tableName: string, dropped: number): void {
    if (dropped > 0) {
      this.logger.warn({ msg: "Skipped malformed metrics rows", tableName, dropped });
    }
  }

  async executeSqlQuery(
    schemaName: string,
    sqlStatement: string,
    parameters?: StatementParameter[],
  ): Promise<Result<SchemaData>> {
    this.logger.debug({
      msg: "Executing SQL query",
      operation: "executeSqlQuery",
      schemaName,
    });
    return this.sqlService.executeSqlQuery(schemaName, sqlStatement, parameters);
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
