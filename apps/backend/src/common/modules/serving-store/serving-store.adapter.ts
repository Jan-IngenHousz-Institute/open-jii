import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "crypto";

import type {
  ExperimentTableMetadata,
  ExperimentTableType,
} from "../../../experiments/core/models/experiment-data.model";
import { PageBytes } from "../../../experiments/core/models/page-bytes.model";
import type {
  ServingStorePort,
  StoreMetadataSheet,
  StoreQuery,
  StoreQueryColumn,
  StoreQueryParams,
} from "../../../experiments/core/ports/serving-store.port";
import type { DeviceLifecycleEventRow } from "../../../iot/core/models/device-lifecycle-event.model";
import type {
  DeviceBatteryRow,
  DeviceFirmwareVersionRow,
  DeviceMacroRow,
  DeviceMeasurementRow,
  DevicePayloadBreakdownRow,
  DeviceThroughputRow,
  ExperimentDeviceSeriesRow,
} from "../../../iot/core/ports/device-reads.port";
import type { ServingStorePort as IotServingStorePort } from "../../../iot/core/ports/serving-store.port";
import { AppError, failure, success } from "../../utils/fp-utils";
import type { Result } from "../../utils/fp-utils";
import { QueryBuilderInputError } from "../databricks/services/query-builder/query-builder.types";
import { VariantSchema } from "../databricks/services/query-builder/schema/variant-schema";
import type { SchemaData } from "../databricks/services/sql/sql.types";
import { CellValues } from "./services/client/cell-values";
import { ServingStoreClientService } from "./services/client/client.service";
import { StoreQueryBuilder } from "./services/query-builder/store-query-builder";
import { StoreTables } from "./services/query-builder/store-tables";

const TABLE_TYPES: Record<string, ExperimentTableType> = {
  static: "static",
  macro: "macro",
  upload: "upload",
};

@Injectable()
export class ServingStoreAdapter implements ServingStorePort, IotServingStorePort {
  private readonly logger = new Logger(ServingStoreAdapter.name);

  constructor(private readonly client: ServingStoreClientService) {}

  isConfigured(): boolean {
    return this.client.isConfigured();
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
   * feed stored per batch merged into one per payload column.
   */
  async getExperimentTableMetadata(
    experimentId: string,
  ): Promise<Result<ExperimentTableMetadata[]>> {
    const experiment = this.experimentArgument(experimentId);
    const tablesSql = [
      `SELECT 'static' AS table_type, 'raw_data' AS identifier, CAST(NULL AS Nullable(String)) AS display_name, count() AS row_count, max(processed_timestamp) AS latest_row_at FROM experiment_measurements(${experiment}) HAVING count() > 0`,
      `SELECT 'macro', macro_id, NULL, count(), max(processed_timestamp) FROM experiment_macro_results(${experiment}) WHERE macro_id IS NOT NULL GROUP BY macro_id`,
      // The newest upload names the table, so a rename shows once it is uploaded.
      `SELECT 'upload', upload_table_id, argMax(upload_table_name, uploaded_at), count(), max(uploaded_at) FROM experiment_uploads(${experiment}) WHERE upload_table_id IS NOT NULL GROUP BY upload_table_id`,
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
      ([tableType, identifier, displayName, rowCount, latestRowAt]) => {
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
    const builder = new StoreQueryBuilder()
      .read(table, params.experimentId, identifier)
      .select(params.columns)
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
      for (const filter of params.filters ?? []) {
        builder.filter(filter);
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
      const query = { sql: builder.build(), columns: builder.outputColumns() };

      // The flagged ids are written into the statement, and a flagged page also sends its count,
      // which wraps it.
      const isFlaggedReadTooLarge =
        params.flagged !== undefined && !this.client.fitsQuerySize(this.countQuery(query).sql);
      if (isFlaggedReadTooLarge) {
        return failure(
          AppError.badRequest(
            "Too many of the table's rows are flagged to filter a read by flags",
            "FLAGGED_READ_TOO_LARGE",
          ),
        );
      }
      return success(query);
    } catch (error) {
      if (error instanceof QueryBuilderInputError) {
        return failure(AppError.badRequest(error.message, "INVALID_QUERY_INPUT"));
      }
      throw error;
    }
  }

  countQuery(query: StoreQuery): StoreQuery {
    return {
      sql: `SELECT toString(count()) AS total FROM (${query.sql}) AS sub`,
      columns: [{ name: "total", type: "BIGINT" }],
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
    const read = await this.client.stream(query.sql, (row) => {
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

  private cells(columns: StoreQueryColumn[], row: unknown[]): (string | null)[] {
    const payloads = this.payloads(columns, row);
    return columns.map(({ type, idOf, text }, index) => {
      const value = row[index];
      if (text !== undefined) {
        return CellValues.payloadCell(payloads.get(text.column), text.key, type);
      }
      if (idOf === "device") {
        return JSON.stringify(value);
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

  async getDeviceLastActivity(thingName: string): Promise<Result<{ lastDataAt: string | null }>> {
    const result = await this.client.query(
      `SELECT last_data_at FROM device_last_activity(${this.deviceArgument(thingName)})`,
    );
    if (result.isFailure()) {
      return result;
    }

    const lastDataAt = result.value.rows.at(0)?.at(0);
    return success({ lastDataAt: CellValues.text(lastDataAt, "TIMESTAMP") });
  }

  /** Scoped on both keys, so it never returns traffic into other experiments. */
  async getExperimentDeviceSeries(
    experimentId: string,
    clientId: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<ExperimentDeviceSeriesRow[]>> {
    const experiment = new StoreQueryBuilder().escapeValue(experimentId);
    const result = await this.client.query(
      [
        `SELECT ${this.timeBucket(bucket)} AS bucket_start, count()`,
        `FROM device_measurements(${this.deviceArgument(clientId)})`,
        `WHERE experiment_id = ${experiment} AND ${this.window("timestamp", from, to)}`,
        "GROUP BY bucket_start",
        "ORDER BY bucket_start ASC",
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(([bucketStart, count]) => ({
        bucketStart: CellValues.text(bucketStart, "TIMESTAMP"),
        count: Number(count),
      })),
    );
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
        eventType: this.textOrNull(eventType),
        eventTimestamp: CellValues.text(eventTimestamp, "TIMESTAMP"),
        disconnectReason: this.textOrNull(disconnectReason),
        sessionIdentifier: this.textOrNull(sessionIdentifier),
      })),
    );
  }

  async getDeviceThroughput(
    thingName: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceThroughputRow[]>> {
    const result = await this.client.query(
      [
        `SELECT ${this.timeBucket(bucket)} AS bucket_start, experiment_id, count()`,
        `FROM device_measurements(${this.deviceArgument(thingName)})`,
        `WHERE ${this.window("timestamp", from, to)}`,
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
        experimentId: this.textOrNull(experimentId),
        count: Number(count),
      })),
    );
  }

  /** avg skips nulls, so a bucket without a reported battery is null. */
  async getDeviceBatterySeries(
    thingName: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceBatteryRow[]>> {
    const result = await this.client.query(
      [
        `SELECT ${this.timeBucket(bucket)} AS bucket_start, avg(device_battery)`,
        `FROM device_measurements(${this.deviceArgument(thingName)})`,
        `WHERE ${this.window("timestamp", from, to)}`,
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
        averageBattery: this.numberOrNull(averageBattery),
      })),
    );
  }

  /** count of a column skips nulls, which is what makes the coverage counts work. */
  async getDevicePayloadBreakdown(
    thingName: string,
    from: string,
    to: string,
  ): Promise<Result<DevicePayloadBreakdownRow[]>> {
    const result = await this.client.query(
      [
        "SELECT device_version, protocol_id, workbook_version_id, workbook_run_id, count(),",
        "  count(latitude), count(device_battery)",
        `FROM device_measurements(${this.deviceArgument(thingName)})`,
        `WHERE ${this.window("timestamp", from, to)}`,
        "GROUP BY device_version, protocol_id, workbook_version_id, workbook_run_id",
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(
        ([version, protocolId, workbookVersionId, workbookRunId, count, withGps, withBattery]) => ({
          deviceVersion: this.textOrNull(version),
          protocolId: this.textOrNull(protocolId),
          workbookVersionId: this.textOrNull(workbookVersionId),
          workbookRunId: this.textOrNull(workbookRunId),
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
    from: string,
    to: string,
  ): Promise<Result<DeviceMacroRow[]>> {
    const result = await this.client.query(
      [
        "SELECT tupleElement(macro, 'id') AS macro_id, count()",
        `FROM device_measurements(${this.deviceArgument(thingName)})`,
        "ARRAY JOIN macros AS macro",
        `WHERE ${this.window("timestamp", from, to)}`,
        "GROUP BY macro_id",
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(([macroId, count]) => ({
        macroId: this.textOrNull(macroId),
        count: Number(count),
      })),
    );
  }

  /** Per (time bucket, version): by version alone a rollback would read as two overlapping runs. */
  async getDeviceFirmwareHistory(
    thingName: string,
    from: string,
    to: string,
    bucket: "hour" | "day",
  ): Promise<Result<DeviceFirmwareVersionRow[]>> {
    const result = await this.client.query(
      [
        "SELECT device_version, min(timestamp) AS first_seen, max(timestamp), count()",
        `FROM device_measurements(${this.deviceArgument(thingName)})`,
        `WHERE ${this.window("timestamp", from, to)}`,
        `GROUP BY ${this.timeBucket(bucket)}, device_version`,
        "ORDER BY first_seen ASC",
      ].join("\n"),
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(([version, firstSeen, lastSeen, count]) => ({
        version: this.textOrNull(version),
        firstSeen: CellValues.text(firstSeen, "TIMESTAMP"),
        lastSeen: CellValues.text(lastSeen, "TIMESTAMP"),
        count: Number(count),
      })),
    );
  }

  /**
   * Newest first. The payload is gold's parsed copy as Spark writes it out, keys in order and NaN
   * as null, where the warehouse shows the device's own text.
   */
  async getDeviceRecentMeasurements(
    thingName: string,
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
          experimentId: this.textOrNull(experimentId),
          protocolId: this.textOrNull(protocolId),
          workbookVersionId: this.textOrNull(workbookVersionId),
          deviceVersion: this.textOrNull(deviceVersion),
          battery: this.numberOrNull(battery),
          latitude: this.numberOrNull(latitude),
          longitude: this.numberOrNull(longitude),
          sample: this.textOrNull(sample),
        }),
      ),
    );
  }

  private experimentArgument(experimentId: string): string {
    return `experiment = ${new StoreQueryBuilder().escapeValue(experimentId)}`;
  }

  /** The device views read only the devices a read names, which the backend has authorized. */
  private deviceArgument(clientId: string): string {
    return `devices = [${new StoreQueryBuilder().escapeValue(clientId)}]`;
  }

  private timeBucket(bucket: "hour" | "day"): string {
    return bucket === "hour" ? "toStartOfHour(timestamp)" : "toStartOfDay(timestamp)";
  }

  private window(column: string, from: string, to: string): string {
    return `${column} BETWEEN ${this.time(from)} AND ${this.time(to)}`;
  }

  /** The store's plain parser reads no zone, so it refuses an ISO time's Z. */
  private time(iso: string): string {
    return `parseDateTime64BestEffort(${new StoreQueryBuilder().escapeValue(iso)}, 6, 'UTC')`;
  }

  private textOrNull(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }

  /** A double JSON has no number for, such as NaN, comes back quoted and reads as no value. */
  private numberOrNull(value: unknown): number | null {
    return typeof value === "number" ? value : null;
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
