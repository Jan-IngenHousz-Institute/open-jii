import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "crypto";

import type {
  ExperimentAsOfJoin,
  ExperimentTableMetadata,
  ExperimentTableType,
} from "../../../experiments/core/models/experiment-data.model";
import { PageBytes } from "../../../experiments/core/models/page-bytes.model";
import type {
  ServingStorePort,
  StoreChangeMark,
  StoreMetadataSheet,
  StoreQuery,
  StoreQueryColumn,
  StoreQueryParams,
} from "../../../experiments/core/ports/serving-store.port";
import { STORE_QUERY_TOO_LARGE } from "../../../experiments/core/ports/serving-store.port";
import type { DeviceLifecycleEventRow } from "../../../iot/core/models/device-lifecycle-event.model";
import type {
  DeviceBatteryRow,
  DeviceFirmwareVersionRow,
  DeviceMacroRow,
  DeviceMeasurementRow,
  DevicePayloadBreakdownRow,
  DeviceThroughputRow,
  DeviceWindow,
} from "../../../iot/core/ports/device-reads.port";
import type { ServingStorePort as IotServingStorePort } from "../../../iot/core/ports/serving-store.port";
import { MetricsTable } from "../../../metrics/core/models/metrics-table.model";
import type {
  ActivityWindowsRow,
  ContributorPairRow,
  DailyActivityRow,
  DevicePairRow,
  HourlyActivityRow,
  ParameterCategory,
  ParameterStatsRow,
  PlatformTotalsRow,
  PoolFactsRow,
  ResourceDailyRow,
  ScopedDailyRow,
} from "../../../metrics/core/ports/metrics-reads.port";
import type {
  ClientTotalsRow,
  ServingStorePort as MetricsServingStorePort,
} from "../../../metrics/core/ports/serving-store.port";
import { AppError, failure, success } from "../../utils/fp-utils";
import type { Result } from "../../utils/fp-utils";
import { hasAggregationContent } from "../databricks/services/query-builder/expressions/aggregation";
import { QueryBuilderInputError } from "../databricks/services/query-builder/query-builder.types";
import { VariantSchema } from "../databricks/services/query-builder/schema/variant-schema";
import type { SchemaData } from "../databricks/services/sql/sql.types";
import { CellValues } from "./services/client/cell-values";
import { ServingStoreClientService } from "./services/client/client.service";
import { StoreAggregation } from "./services/query-builder/store-aggregation";
import { StoreQueryBuilder } from "./services/query-builder/store-query-builder";
import type { StoreAsOfSecondary } from "./services/query-builder/store-query-builder";
import { StoreTables } from "./services/query-builder/store-tables";

/** The setting the reader's row policy on each table reads (infrastructure/modules/serving-store). */
export const EXPERIMENT_SETTING = "SQL_experiment";

// The store's DateTime64 range, which the feed clamps every capture time into.
const WHOLE_HISTORY: DeviceWindow = {
  from: "1900-01-01T00:00:00Z",
  to: "2299-12-31T23:59:59.999999Z",
};

const TABLE_TYPES: Record<string, ExperimentTableType> = {
  static: "static",
  macro: "macro",
  upload: "upload",
};

@Injectable()
export class ServingStoreAdapter
  implements ServingStorePort, IotServingStorePort, MetricsServingStorePort
{
  private readonly logger = new Logger(ServingStoreAdapter.name);

  // Every device page asks, and the answer changes once, when the events reload lands.
  private static readonly DEVICE_EVENTS_CHECK_TTL_MS = 60_000;
  // A hanging store makes a check wait out the client's timeout. A failed check answers for this
  // long without asking, so the wait is paid once per task, not per request.
  private static readonly DEVICE_EVENTS_PAUSE_MS = 10_000;
  private deviceEventsCheck: { result: Result<boolean>; expiresAt: number } | null = null;
  // A page load asks for several reads at once; they share one check.
  private pendingDeviceEventsCheck: Promise<Result<boolean>> | null = null;

  constructor(private readonly client: ServingStoreClientService) {}

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  hasDeviceEventsLoaded(): Promise<Result<boolean>> {
    const cached = this.deviceEventsCheck;
    if (cached !== null && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.result);
    }

    this.pendingDeviceEventsCheck ??= this.checkDeviceEventsLoaded().finally(() => {
      this.pendingDeviceEventsCheck = null;
    });
    return this.pendingDeviceEventsCheck;
  }

  private async checkDeviceEventsLoaded(): Promise<Result<boolean>> {
    const read = await this.client.query("SELECT reloaded FROM device_events_reloaded");
    if (read.isFailure()) {
      this.logger.warn({
        msg: "Device events check failed; device pages read from the warehouse",
        operation: "hasDeviceEventsLoaded",
        errorCode: read.error.code,
      });
      this.deviceEventsCheck = {
        result: read,
        expiresAt: Date.now() + ServingStoreAdapter.DEVICE_EVENTS_PAUSE_MS,
      };
      return read;
    }

    const result = success(read.value.rows.length > 0);
    this.deviceEventsCheck = {
      result,
      expiresAt: Date.now() + ServingStoreAdapter.DEVICE_EVENTS_CHECK_TTL_MS,
    };
    return result;
  }

  holdsTable(tableName: string): boolean {
    return StoreTables.holds(tableName);
  }

  takesCustomMetadata(tableType: ExperimentTableType, tableName: string): boolean {
    return StoreTables.of(tableType, tableName)?.takesCustomMetadata === true;
  }

  reservedNames(): readonly string[] {
    return StoreQueryBuilder.reservedNames;
  }

  async getMetadataSheets(experimentId: string): Promise<Result<StoreMetadataSheet[]>> {
    const experiment = this.experimentArgument(experimentId);
    const sql = `SELECT sheet_id, match_on, schema, toString(_commit_version) FROM experiment_metadata_sheets(${experiment}) ORDER BY sheet_created_at, sheet_id`;

    const result = await this.client.query(sql);
    if (result.isFailure()) {
      return result;
    }
    return success(
      result.value.rows.map(([id, matchOn, schema, version]) => ({
        id: String(id),
        matchOn: String(matchOn),
        schema: typeof schema === "string" ? schema : null,
        version: String(version),
      })),
    );
  }

  /**
   * Each table with rows, counted when read as gold's listing counts them, with the schemas the
   * feed stored per batch merged into one per payload column and a revision of the rows it holds.
   */
  async getExperimentTableMetadata(
    experimentId: string,
  ): Promise<Result<ExperimentTableMetadata[]>> {
    const experiment = this.experimentArgument(experimentId);
    // Every insert stamps arrived_at afresh and no writer sets it, so a sum over the rows that win
    // moves with any replacement, whichever insert was stamped or became visible first.
    const contentRevision = "toString(sum(cityHash64(_commit_version, arrived_at)))";
    const tablesSql = [
      `SELECT 'static' AS table_type, 'raw_data' AS identifier, CAST(NULL AS Nullable(String)) AS display_name, count() AS row_count, max(processed_timestamp) AS latest_row_at, ${contentRevision} AS content_revision FROM experiment_measurements(${experiment}) HAVING count() > 0`,
      `SELECT 'macro', macro_id, NULL, count(), max(processed_timestamp), ${contentRevision} FROM experiment_macro_results(${experiment}) WHERE macro_id IS NOT NULL GROUP BY macro_id`,
      // The newest upload names the table, so a rename shows once it is uploaded.
      `SELECT 'upload', upload_table_id, argMax(upload_table_name, uploaded_at), count(), max(uploaded_at), ${contentRevision} FROM experiment_uploads(${experiment}) WHERE upload_table_id IS NOT NULL GROUP BY upload_table_id`,
    ].join("\nUNION ALL\n");
    const schemasSql = `SELECT table_type, identifier, payload, schema FROM experiment_payload_schemas(${experiment})`;

    const [tablesResult, schemasResult] = await Promise.all([
      this.client.query(tablesSql),
      this.client.query(schemasSql),
    ]);
    if (tablesResult.isFailure()) {
      return tablesResult;
    }
    if (schemasResult.isFailure()) {
      return schemasResult;
    }

    const schemas = this.mergedSchemas(schemasResult.value.rows);
    const tables = tablesResult.value.rows.map(
      ([tableType, identifier, displayName, rowCount, latestRowAt, revision]) => {
        const type = TABLE_TYPES[String(tableType)] ?? "static";
        const name = String(identifier);
        const schemaOf = (payload: string) => schemas.get(`${type}:${name}:${payload}`) ?? null;
        const macroSchema = type === "macro" ? schemaOf("macro_output") : null;
        const questionsSchema = type === "upload" ? null : schemaOf("questions_data");
        const uploadSchema = type === "upload" ? schemaOf("uploaded_data") : null;
        return {
          identifier: name,
          tableType: type,
          displayName: typeof displayName === "string" ? displayName : null,
          rowCount: Number(rowCount),
          latestRowAt: CellValues.text(latestRowAt, "TIMESTAMP"),
          schemaRevision: this.schemaRevision([macroSchema, questionsSchema, null, uploadSchema]),
          contentRevision: typeof revision === "string" ? revision : null,
          macroSchema,
          questionsSchema,
          customMetadataSchema: null,
          uploadSchema,
        };
      },
    );

    this.logger.debug({
      msg: "Read experiment tables from the store",
      operation: "getExperimentTableMetadata",
      experimentId,
      tables: tables.length,
    });
    return success(tables);
  }

  /**
   * Reads the tables directly rather than through their FINAL views, so their arrival time indexes
   * can leave granules whose rows all arrived before `since` unread.
   */
  async getExperimentChangeMark(
    experimentId: string,
    since: string | null,
  ): Promise<Result<StoreChangeMark>> {
    const escape = (value: string) => new StoreQueryBuilder().escapeValue(value);
    // A row is stamped as its insert begins and counted once it finishes, so the start trails the
    // store's clock by more than any insert takes.
    const nextFrom = "now64(6, 'UTC') - INTERVAL 10 MINUTE";
    const from = since === null ? nextFrom : `toDateTime64(${escape(since)}, 6, 'UTC')`;
    const arrived = ["measurements", "macro_results", "uploads"]
      .map(
        (table) =>
          `SELECT arrived_at FROM ${table} WHERE experiment_id = ${escape(experimentId)} AND arrived_at >= least(${from}, ${nextFrom})`,
      )
      .join(" UNION ALL ");
    // Rows that arrived together or out of order still change the count, and a replacement that
    // a merge has already folded in still moves the newest arrival.
    const arrivalsFrom = (start: string) =>
      `concat(toString(countIf(arrived_at >= ${start})), ':', toString(maxIf(arrived_at, arrived_at >= ${start})))`;
    const experiment = this.experimentArgument(experimentId);
    const sql = `${[
      `SELECT toString(${from})`,
      arrivalsFrom(from),
      `toString(${nextFrom})`,
      arrivalsFrom(nextFrom),
      `(SELECT count() FROM experiment_payload_schemas(${experiment}))`,
      `(SELECT concat(toString(count()), ':', toString(max(_commit_version))) FROM experiment_metadata_sheets(${experiment}))`,
    ].join(", ")} FROM (${arrived})`;

    const rows: unknown[][] = [];
    const read = await this.client.stream(sql, { [EXPERIMENT_SETTING]: experimentId }, (row) => {
      rows.push(row);
      return true;
    });
    if (read.isFailure()) {
      return read;
    }
    const [countedFrom, arrivals, nextCountedFrom, nextArrivals, schemas, sheets] =
      rows.at(0) ?? [];
    const others = `${String(schemas)}|${String(sheets)}`;
    return success({
      since: String(countedFrom),
      revision: `${String(arrivals)}|${others}`,
      next: { since: String(nextCountedFrom), revision: `${String(nextArrivals)}|${others}` },
    });
  }

  getExperimentTableColumns(
    tableType: ExperimentTableType,
    tableName: string,
  ): Result<StoreQueryColumn[]> {
    const table = StoreTables.of(tableType, tableName);
    if (table === null) {
      return failure(AppError.notFound(`The store holds no table '${tableName}'`));
    }
    return success(table.columns.map(({ name, type, idOf }) => ({ name, type, idOf })));
  }

  buildExperimentQuery(params: StoreQueryParams): Result<StoreQuery> {
    const table = StoreTables.of(params.tableType, params.tableName);
    if (table === null) {
      return failure(AppError.notFound(`The store holds no table '${params.tableName}'`));
    }

    const identifier = params.tableType === "static" ? undefined : params.tableName;
    const { aggregation } = params;
    const isAggregated = aggregation !== undefined && hasAggregationContent(aggregation);
    const builder = new StoreQueryBuilder();
    if (params.isChartRead) {
      builder.readForChart(table, params.experimentId, identifier);
    } else {
      builder.read(table, params.experimentId, identifier);
    }
    builder
      // An aggregation's windows and groups read columns its chart may not show, so it reads whole
      // rows and keeps the chart's columns itself.
      .select(isAggregated ? undefined : params.columns)
      .reserve(params.reservedColumns ?? [])
      .serialNumbers(params.deviceSerials ?? [])
      .metadataSheets(params.metadataSheets ?? []);

    if (params.distinct) {
      builder.distinct();
    }
    for (const { columnName, schema, suffix } of params.variants ?? []) {
      builder.parseVariant(columnName, schema, suffix);
    }
    if (params.exceptColumns && params.exceptColumns.length > 0) {
      builder.except(params.exceptColumns);
    }

    if (params.flagged !== undefined) {
      builder.flagged(params.flagged.kind, params.flagged.addedRowIds);
    }

    try {
      if (params.join !== undefined) {
        const secondary = this.asOfSecondary(params, params.join);
        if (secondary.isFailure()) {
          return secondary;
        }
        builder.joinAsOf(secondary.value, {
          column: params.join.matchColumn,
          time: params.join.primaryTimeColumn,
          toleranceMinutes: params.join.toleranceMinutes,
        });
      }
      for (const filter of params.filters ?? []) {
        builder.filter(filter);
      }
      if (isAggregated) {
        const aggregated = new StoreAggregation(builder, aggregation).build({
          ordering: params.ordering,
          limit: params.limit,
          offset: params.offset,
          idOrder: params.orderByIds,
          columns: params.columns,
        });
        return this.withinQuerySize(params, {
          ...aggregated,
          experiment: this.policyExperiment(builder, params),
        });
      }
      if (params.ordering) {
        builder.orderBy(params.ordering, params.orderByIds);
      }
      if (params.limit !== undefined) {
        builder.limit(params.limit);
      }
      if (params.offset !== undefined) {
        builder.offset(params.offset);
      }
      return this.withinQuerySize(params, {
        sql: builder.build(),
        columns: builder.outputColumns(),
        experiment: this.policyExperiment(builder, params),
      });
    } catch (error) {
      if (error instanceof QueryBuilderInputError) {
        return failure(AppError.badRequest(error.message, "INVALID_QUERY_INPUT"));
      }
      throw error;
    }
  }

  /**
   * A statement writes the ids it reads by, such as flagged rows or every registered device, and a
   * flagged read or a chart also sends its count, which wraps it, so both must fit the store's limit
   * on a statement's text. Only the store reads by flags, so a flagged read past it is refused; a
   * chart past it fails with a code its reader answers from the warehouse.
   */
  private withinQuerySize(params: StoreQueryParams, query: StoreQuery): Result<StoreQuery> {
    const isMeasured = params.flagged !== undefined || params.isChartRead === true;
    const isTooLarge = isMeasured && !this.client.fitsQuerySize(this.countQuery(query).sql);
    if (!isTooLarge) {
      return success(query);
    }
    if (params.flagged !== undefined) {
      return failure(
        AppError.badRequest(
          "Too many of the table's rows are flagged to filter a read by flags",
          "FLAGGED_READ_TOO_LARGE",
        ),
      );
    }
    return failure(
      AppError.internal(
        "The chart's statement passes the store's limit on a query's size",
        STORE_QUERY_TOO_LARGE,
      ),
    );
  }

  /**
   * A statement that reads a table, a chart's or a joined read's second table, names its
   * experiment to the reader's row policy; one that reads only views sends none, so a store whose
   * config lags the backend still serves pages.
   */
  private policyExperiment(
    builder: StoreQueryBuilder,
    params: StoreQueryParams,
  ): string | undefined {
    return builder.readsTables() ? params.experimentId : undefined;
  }

  /** The second table of an as-of read, from the same experiment and its devices. */
  private asOfSecondary(
    params: StoreQueryParams,
    join: ExperimentAsOfJoin,
  ): Result<StoreAsOfSecondary> {
    const { secondary } = join;
    const table = StoreTables.of(secondary.tableType, secondary.tableName);
    if (table === null) {
      return failure(AppError.notFound(`The store holds no table '${secondary.tableName}'`));
    }

    const identifier = secondary.tableType === "static" ? undefined : secondary.tableName;
    const builder = new StoreQueryBuilder()
      .readForChart(table, params.experimentId, identifier)
      .reserve(secondary.reservedColumns ?? [])
      .serialNumbers(params.deviceSerials ?? [])
      .metadataSheets(params.metadataSheets ?? []);
    for (const { columnName, schema, suffix } of secondary.variants ?? []) {
      builder.parseVariant(columnName, schema, suffix);
    }
    if (secondary.exceptColumns && secondary.exceptColumns.length > 0) {
      builder.except(secondary.exceptColumns);
    }
    return success(
      builder.buildAsOfSecondary({
        column: join.matchColumn,
        time: join.secondaryTimeColumn,
        columns: builder.secondaryColumnsRead(params, join),
      }),
    );
  }

  countQuery(query: StoreQuery): StoreQuery {
    return {
      sql: `SELECT toString(count()) AS total FROM (${query.sql}) AS sub`,
      columns: [{ name: "total", type: "BIGINT" }],
      experiment: query.experiment,
    };
  }

  deviceLabelsQuery(query: StoreQuery, limit: number, offset: number): StoreQuery {
    const label = new StoreQueryBuilder().quoteName("device.serial_number");
    return {
      sql: [
        `SELECT DISTINCT ${label} AS serial_number`,
        `FROM (${query.sql}) AS device_names`,
        `WHERE ${label} IS NOT NULL AND trim(${label}) != ''`,
        // Spark lowers text by Unicode, as lowerUTF8 does and lower does not.
        `ORDER BY lowerUTF8(${label}) ASC, ${label} ASC`,
        `LIMIT ${limit}`,
        `OFFSET ${offset}`,
      ].join("\n"),
      columns: [{ name: "serial_number", type: "STRING" }],
      experiment: query.experiment,
    };
  }

  /**
   * The rows as the warehouse writes its cells, with contributors and devices as their ids. A read
   * whose cells pass the page limit stops before the row that passes it, keeps the rows that fit
   * and is marked truncated, so the rest is never held. Filling a contributor or a device in only
   * lengthens its cell, so a device counts as nothing until then, and a read stopped here would
   * also be refused once filled.
   */
  async executeQuery(query: StoreQuery): Promise<Result<SchemaData>> {
    const rows: (string | null)[][] = [];
    const size = new PageBytes();
    const read = await this.client.stream(query.sql, this.settingsOf(query), (row) => {
      const cells = this.cells(query.columns, row);
      size.add(cells.map((cell, index) => (query.columns[index].idOf === "device" ? null : cell)));
      if (size.exceedsLimit) {
        return false;
      }
      rows.push(cells);
      return true;
    });
    if (read.isFailure()) {
      return read;
    }

    const columns = query.columns.map(({ name, type }, position) => ({
      name,
      type_name: this.typeName(type),
      type_text: type,
      position,
    }));
    return success({ columns, rows, totalRows: rows.length, truncated: !read.value.complete });
  }

  private settingsOf({ experiment }: StoreQuery): Record<string, string> {
    return experiment === undefined ? {} : { [EXPERIMENT_SETTING]: experiment };
  }

  private cells(columns: StoreQueryColumn[], row: unknown[]): (string | null)[] {
    const payloads = this.payloads(columns, row);
    return columns.map(({ type, idOf, text, isPairText }, index) => {
      const value = row[index];
      if (text !== undefined) {
        return CellValues.payloadCell(payloads.get(text.column), text.key, type);
      }
      if (idOf === "device") {
        const isPairTextCell = isPairText === true && (typeof value === "string" || value === null);
        return isPairTextCell ? value : JSON.stringify(value);
      }
      if (idOf === "contributor") {
        return typeof value === "string" ? value : null;
      }
      return CellValues.text(value, type);
    });
  }

  /** The row's payloads, each parsed once from the first column that carries its text. */
  private payloads(columns: StoreQueryColumn[], row: unknown[]): Map<string, unknown> {
    const payloads = new Map<string, unknown>();
    columns.forEach(({ text }, index) => {
      if (text !== undefined && !payloads.has(text.column)) {
        payloads.set(text.column, CellValues.payload(row[index]));
      }
    });
    return payloads;
  }

  async getExperimentIds(
    experimentId: string,
    of: "contributor" | "device",
  ): Promise<Result<string[]>> {
    const experiment = this.experimentArgument(experimentId);
    const sql =
      of === "contributor"
        ? `SELECT user_id FROM experiment_contributor_ids(${experiment})`
        : `SELECT client_id FROM experiment_client_ids(${experiment})`;

    const result = await this.client.query(sql);
    if (result.isFailure()) {
      return result;
    }
    return success(result.value.rows.flatMap(([id]) => (typeof id === "string" ? [id] : [])));
  }

  async getDeviceLastActivity(
    thingName: string,
    experimentIds: string[],
  ): Promise<Result<{ lastDataAt: string | null }>> {
    const device = this.deviceArgument(thingName);
    const experiments = `experiments = ${this.experimentList(experimentIds)}`;
    const result = await this.client.query(
      `SELECT last_data_at FROM device_last_activity(${device}, ${experiments})`,
    );
    if (result.isFailure()) {
      return result;
    }

    const lastDataAt = result.value.rows.at(0)?.at(0);
    return success({ lastDataAt: CellValues.text(lastDataAt, "TIMESTAMP") });
  }

  async getDeviceExperimentIds(
    thingName: string,
    window?: DeviceWindow,
  ): Promise<Result<string[]>> {
    const result = await this.client.query(
      [
        "SELECT experiment_id",
        `FROM device_experiment_ids(${this.deviceWindowArguments(thingName, window ?? WHOLE_HISTORY)})`,
        "ORDER BY experiment_id",
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(result.value.rows.flatMap(([id]) => (typeof id === "string" ? [id] : [])));
  }

  async getDeviceLifecycleEvents(
    thingName: string,
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<DeviceLifecycleEventRow[]>> {
    const result = await this.client.query(
      [
        "SELECT event_type, event_timestamp, disconnect_reason, session_identifier",
        `FROM device_lifecycle_events(${this.deviceArgument(thingName)})`,
        `WHERE ${this.window("event_timestamp", from, to)}`,
        "ORDER BY event_timestamp ASC",
        `LIMIT ${limit}`,
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(([eventType, eventTimestamp, disconnectReason, sessionIdentifier]) => ({
        eventType: CellValues.textOrNull(eventType),
        eventTimestamp: CellValues.text(eventTimestamp, "TIMESTAMP"),
        disconnectReason: CellValues.textOrNull(disconnectReason),
        sessionIdentifier: CellValues.textOrNull(sessionIdentifier),
      })),
    );
  }

  async getDeviceThroughput(
    thingName: string,
    experimentIds: string[],
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceThroughputRow[]>> {
    const result = await this.client.query(
      [
        `SELECT ${this.timeBucket(bucket)} AS bucket_start, experiment_id, count()`,
        `FROM device_measurements(${this.deviceWindowArguments(thingName, { from, to })})`,
        `WHERE ${this.window("timestamp", from, to)} AND ${this.experimentRows(experimentIds)}`,
        "GROUP BY bucket_start, experiment_id",
        "ORDER BY bucket_start ASC",
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(([bucketStart, experimentId, count]) => ({
        bucketStart: CellValues.text(bucketStart, "TIMESTAMP"),
        experimentId: CellValues.textOrNull(experimentId),
        count: Number(count),
      })),
    );
  }

  /** avg skips nulls, so a bucket without a reported battery is null. */
  async getDeviceBatterySeries(
    thingName: string,
    experimentIds: string[],
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceBatteryRow[]>> {
    const result = await this.client.query(
      [
        `SELECT ${this.timeBucket(bucket)} AS bucket_start, avg(device_battery)`,
        `FROM device_measurements(${this.deviceWindowArguments(thingName, { from, to })})`,
        `WHERE ${this.window("timestamp", from, to)} AND ${this.experimentRows(experimentIds)}`,
        "GROUP BY bucket_start",
        "ORDER BY bucket_start ASC",
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(([bucketStart, averageBattery]) => ({
        bucketStart: CellValues.text(bucketStart, "TIMESTAMP"),
        averageBattery: CellValues.numberOrNull(averageBattery),
      })),
    );
  }

  /** count of a column skips nulls, which is what makes the coverage counts work. */
  async getDevicePayloadBreakdown(
    thingName: string,
    experimentIds: string[],
    from: string,
    to: string,
  ): Promise<Result<DevicePayloadBreakdownRow[]>> {
    const result = await this.client.query(
      [
        "SELECT device_version, protocol_id, workbook_version_id, workbook_run_id, count(),",
        "  count(latitude), count(device_battery)",
        `FROM device_measurements(${this.deviceWindowArguments(thingName, { from, to })})`,
        `WHERE ${this.window("timestamp", from, to)} AND ${this.experimentRows(experimentIds)}`,
        "GROUP BY device_version, protocol_id, workbook_version_id, workbook_run_id",
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(
        ([version, protocolId, workbookVersionId, workbookRunId, count, withGps, withBattery]) => ({
          deviceVersion: CellValues.textOrNull(version),
          protocolId: CellValues.textOrNull(protocolId),
          workbookVersionId: CellValues.textOrNull(workbookVersionId),
          workbookRunId: CellValues.textOrNull(workbookRunId),
          count: Number(count),
          withGps: Number(withGps),
          withBattery: Number(withBattery),
        }),
      ),
    );
  }

  /** A measurement can carry several macros, so counts can exceed the measurement total. */
  async getDeviceMacroBreakdown(
    thingName: string,
    experimentIds: string[],
    from: string,
    to: string,
  ): Promise<Result<DeviceMacroRow[]>> {
    const result = await this.client.query(
      [
        "SELECT tupleElement(macro, 'id') AS macro_id, count()",
        `FROM device_measurements(${this.deviceWindowArguments(thingName, { from, to })})`,
        "ARRAY JOIN macros AS macro",
        `WHERE ${this.window("timestamp", from, to)} AND ${this.experimentRows(experimentIds)}`,
        "GROUP BY macro_id",
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(([macroId, count]) => ({
        macroId: CellValues.textOrNull(macroId),
        count: Number(count),
      })),
    );
  }

  /** Per (time bucket, version): by version alone a rollback would read as two overlapping runs. */
  async getDeviceFirmwareHistory(
    thingName: string,
    experimentIds: string[],
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceFirmwareVersionRow[]>> {
    const result = await this.client.query(
      [
        "SELECT device_version, min(timestamp) AS first_seen, max(timestamp), count()",
        `FROM device_measurements(${this.deviceWindowArguments(thingName, { from, to })})`,
        `WHERE ${this.window("timestamp", from, to)} AND ${this.experimentRows(experimentIds)}`,
        `GROUP BY ${this.timeBucket(bucket)}, device_version`,
        "ORDER BY first_seen ASC",
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(([version, firstSeen, lastSeen, count]) => ({
        version: CellValues.textOrNull(version),
        firstSeen: CellValues.text(firstSeen, "TIMESTAMP"),
        lastSeen: CellValues.text(lastSeen, "TIMESTAMP"),
        count: Number(count),
      })),
    );
  }

  /** Newest first, each payload as gold's text: keys sorted, NaN as null. */
  async getDeviceRecentMeasurements(
    thingName: string,
    experimentIds: string[],
    from: string,
    to: string,
    limit: number,
  ): Promise<Result<DeviceMeasurementRow[]>> {
    const builder = new StoreQueryBuilder();
    const result = await this.client.query(
      [
        "SELECT timestamp, experiment_id, protocol_id, workbook_version_id, device_version,",
        "  device_battery, latitude, longitude, data",
        "FROM device_newest_measurements(",
        `  device = ${builder.escapeValue(thingName)},`,
        `  experiments = ${this.experimentList(experimentIds)},`,
        `  from = ${this.time(from)},`,
        `  to = ${this.time(to)},`,
        `  rows = ${limit}`,
        ")",
        "ORDER BY timestamp DESC, id DESC",
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(
        ([
          timestamp,
          experimentId,
          protocolId,
          workbookVersionId,
          deviceVersion,
          battery,
          latitude,
          longitude,
          sample,
        ]) => ({
          timestamp: CellValues.text(timestamp, "TIMESTAMP"),
          experimentId: CellValues.textOrNull(experimentId),
          protocolId: CellValues.textOrNull(protocolId),
          workbookVersionId: CellValues.textOrNull(workbookVersionId),
          deviceVersion: CellValues.textOrNull(deviceVersion),
          battery: CellValues.numberOrNull(battery),
          latitude: CellValues.numberOrNull(latitude),
          longitude: CellValues.numberOrNull(longitude),
          sample: CellValues.textOrNull(sample),
        }),
      ),
    );
  }

  async getPublicPlatformTotals(): Promise<Result<PlatformTotalsRow | null>> {
    const columns = [
      "total_measurements",
      "total_volume_bytes",
      "total_uploaded_rows",
      "total_macro_executions",
      "devices_all_time",
      "experiments_with_data",
      "first_measurement_at",
      "last_measurement_at",
      "computed_at",
    ];
    const result = await this.readMetricsView("metrics_platform_totals", columns, "LIMIT 1");
    return result.isFailure() ? result : success(result.value.platformTotals());
  }

  async getPublicDailyActivity(days: number): Promise<Result<DailyActivityRow[]>> {
    const columns = ["date", "measurements", "cumulative_measurements", "volume_bytes"];
    const result = await this.readMetricsView(
      "metrics_daily_activity",
      columns,
      `ORDER BY date DESC LIMIT ${days}`,
    );
    if (result.isFailure()) {
      return result;
    }

    const mapped = result.value.dailyActivity();
    this.warnDroppedMetricsRows("metrics_daily_activity", result.value.rows.length - mapped.length);
    return success(mapped.reverse());
  }

  async getClientTotals(): Promise<Result<ClientTotalsRow[]>> {
    const result = await this.readMetricsView("metrics_client_totals", [
      "client_id",
      "total_measurements",
    ]);
    if (result.isFailure()) {
      return result;
    }

    const mapped = result.value.clientTotals();
    this.warnDroppedMetricsRows("metrics_client_totals", result.value.rows.length - mapped.length);
    return success(mapped);
  }

  async getActivityWindows(): Promise<Result<ActivityWindowsRow | null>> {
    const columns = [
      "measurements_24h",
      "measurements_30d",
      "experiments_30d",
      "contributors_30d",
      "devices_30d",
      "last_measurement_at",
      "computed_at",
    ];
    const result = await this.readMetricsView("metrics_activity_windows", columns, "LIMIT 1");
    return result.isFailure() ? result : success(result.value.activityWindows());
  }

  async getHourlyActivity(): Promise<Result<HourlyActivityRow[]>> {
    const result = await this.readMetricsView(
      "metrics_hourly_activity",
      ["hour_local", "measurements"],
      "ORDER BY hour_local ASC",
    );
    if (result.isFailure()) {
      return result;
    }

    const mapped = result.value.hourlyActivity();
    this.warnDroppedMetricsRows(
      "metrics_hourly_activity",
      result.value.rows.length - mapped.length,
    );
    return success(mapped);
  }

  async getTopParameter(category: ParameterCategory): Promise<Result<ParameterStatsRow | null>> {
    const result = await this.readMetricsView(
      "metrics_parameter_stats",
      ["parameter", "label", "observations", "median_value"],
      `WHERE category = ${new StoreQueryBuilder().escapeValue(category)}`,
    );
    if (result.isFailure()) {
      return result;
    }

    // Every refresh writes each category a row without a parameter, so a category with no row at
    // all has not refreshed yet, and reads as a failure, as a warehouse table not yet written does.
    const hasRefreshed = result.value.rows.length > 0;
    if (!hasRefreshed) {
      return failure(AppError.notFound("metrics_parameter_stats has not refreshed yet"));
    }

    return success(result.value.topParameter());
  }

  async getPoolFacts(): Promise<Result<PoolFactsRow | null>> {
    const columns = [
      "session_median_measurements",
      "mean_arrival_gap_seconds",
      "current_streak_days",
      "device_endurance_days",
      "simultaneity_peak_devices",
      "timezones_all_time",
      "timezones_peak_day",
    ];
    const result = await this.readMetricsView("metrics_pool_facts", columns, "LIMIT 1");
    return result.isFailure() ? result : success(result.value.poolFacts());
  }

  async getScopedDailyActivity(days: number): Promise<Result<ScopedDailyRow[]>> {
    const result = await this.readMetricsView(
      "metrics_daily_activity_by_experiment",
      ["date", "experiment_id", "measurements"],
      `WHERE ${this.lastDays(days)} ORDER BY date ASC`,
    );
    if (result.isFailure()) {
      return result;
    }

    const mapped = result.value.scopedDaily();
    this.warnDroppedMetricsRows(
      "metrics_daily_activity_by_experiment",
      result.value.rows.length - mapped.length,
    );
    return success(mapped);
  }

  async getResourceDailyActivity(
    resourceType: string,
    days: number,
  ): Promise<Result<ResourceDailyRow[]>> {
    const type = new StoreQueryBuilder().escapeValue(resourceType);
    const result = await this.readMetricsView(
      "metrics_daily_activity_by_resource",
      ["date", "resource_type", "resource_id", "measurements"],
      `WHERE resource_type = ${type} AND ${this.lastDays(days)} ORDER BY date ASC`,
    );
    if (result.isFailure()) {
      return result;
    }

    const mapped = result.value.resourceDaily();
    this.warnDroppedMetricsRows(
      "metrics_daily_activity_by_resource",
      result.value.rows.length - mapped.length,
    );
    return success(mapped);
  }

  async getContributorPairs(): Promise<Result<ContributorPairRow[]>> {
    const result = await this.readMetricsView("metrics_experiment_contributors_window", [
      "experiment_id",
      "user_id",
    ]);
    if (result.isFailure()) {
      return result;
    }

    const mapped = result.value.contributorPairs();
    this.warnDroppedMetricsRows(
      "metrics_experiment_contributors_window",
      result.value.rows.length - mapped.length,
    );
    return success(mapped);
  }

  async getDevicePairs(): Promise<Result<DevicePairRow[]>> {
    const result = await this.readMetricsView("metrics_experiment_devices_window", [
      "experiment_id",
      "client_id",
    ]);
    if (result.isFailure()) {
      return result;
    }

    const mapped = result.value.devicePairs();
    this.warnDroppedMetricsRows(
      "metrics_experiment_devices_window",
      result.value.rows.length - mapped.length,
    );
    return success(mapped);
  }

  /**
   * A metrics view's columns, each cell as the warehouse's text: the views hold only numbers, text,
   * dates and times, and the store quotes a NaN double, which reads as no number either way.
   */
  private async readMetricsView(
    view: string,
    columns: string[],
    clauses = "",
  ): Promise<Result<MetricsTable>> {
    const result = await this.client.query(`SELECT ${columns.join(", ")} FROM ${view} ${clauses}`);
    if (result.isFailure()) {
      return result;
    }

    const rows = result.value.rows.map((row) =>
      row.map((value) =>
        typeof value === "string" || typeof value === "number" ? String(value) : null,
      ),
    );
    const index = Object.fromEntries(columns.map((column, position) => [column, position]));
    return success(new MetricsTable(rows, index));
  }

  /** Today and the `days - 1` dates before it, as the warehouse's metrics reads bound them. */
  private lastDays(days: number): string {
    const to = new Date();
    const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const asDate = (value: Date) =>
      new StoreQueryBuilder().escapeValue(value.toISOString().slice(0, 10));
    return `date BETWEEN ${asDate(from)} AND ${asDate(to)}`;
  }

  private warnDroppedMetricsRows(view: string, dropped: number): void {
    if (dropped > 0) {
      this.logger.warn({
        msg: "Skipped malformed metrics rows",
        operation: "readMetricsView",
        view,
        dropped,
      });
    }
  }

  private experimentArgument(experimentId: string): string {
    return `experiment = ${new StoreQueryBuilder().escapeValue(experimentId)}`;
  }

  private deviceArgument(clientId: string): string {
    return `devices = [${new StoreQueryBuilder().escapeValue(clientId)}]`;
  }

  /** A device view looks the device's rows up in the window before it reads them. */
  private deviceWindowArguments(clientId: string, { from, to }: DeviceWindow): string {
    return `${this.deviceArgument(clientId)}, from = ${this.time(from)}, to = ${this.time(to)}`;
  }

  /** The store keeps no row without an experiment, so the given experiments bound a read. */
  private experimentRows(experimentIds: string[]): string {
    return `has(CAST(${this.experimentList(experimentIds)} AS Array(String)), experiment_id)`;
  }

  private experimentList(experimentIds: string[]): string {
    const builder = new StoreQueryBuilder();
    return `[${experimentIds.map((id) => builder.escapeValue(id)).join(", ")}]`;
  }

  /** As charts truncate: toStartOfHour would wrap a time before 1970 into DateTime's range. */
  private timeBucket(bucket: "hour" | "day"): string {
    return new StoreQueryBuilder().buildTimeBucketExpression("timestamp", bucket).sql;
  }

  private window(column: string, from: string, to: string): string {
    return `${column} BETWEEN ${this.time(from)} AND ${this.time(to)}`;
  }

  /** The store's plain parser reads no zone, so it refuses an ISO time's Z. */
  private time(iso: string): string {
    return `parseDateTime64BestEffort(${new StoreQueryBuilder().escapeValue(iso)}, 6, 'UTC')`;
  }

  private mergedSchemas(rows: unknown[][]): Map<string, string | null> {
    const batches = new Map<string, string[]>();
    for (const [tableType, identifier, payload, schema] of rows) {
      const key = `${String(tableType)}:${String(identifier)}:${String(payload)}`;
      batches.set(key, [...(batches.get(key) ?? []), String(schema)]);
    }
    return new Map([...batches].map(([key, schemas]) => [key, VariantSchema.merge(schemas)]));
  }

  /**
   * Gold's listing fingerprints the macro, questions, custom metadata and upload schemas the same
   * way, so the two revisions agree.
   */
  private schemaRevision(schemas: (string | null)[]): string {
    const joined = schemas.map((schema) => schema ?? "").join("|");
    return createHash("md5").update(joined).digest("hex");
  }

  private typeName(type: string): string {
    if (type.startsWith("ARRAY<")) {
      return "ARRAY";
    }
    if (type.startsWith("STRUCT<")) {
      return "STRUCT";
    }
    if (type.startsWith("DECIMAL(")) {
      return "DECIMAL";
    }
    return type === "BIGINT" ? "LONG" : type;
  }
}
