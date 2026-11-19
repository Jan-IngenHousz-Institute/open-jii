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
export class ServingStoreAdapter implements ServingStorePort, MetricsServingStorePort {
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
    const result = await this.client.query(
      "SELECT client_id, total_measurements FROM metrics_client_totals",
    );
    if (result.isFailure()) {
      return result;
    }

    return success(
      result.value.rows.map(([clientId, measurements]) => ({
        clientId: typeof clientId === "string" ? clientId : null,
        measurements: Number(measurements),
      })),
    );
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
    return result.isFailure() ? result : success(result.value.topParameter());
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
      this.logger.warn({ msg: "Skipped malformed metrics rows", view, dropped });
    }
  }

  private experimentArgument(experimentId: string): string {
    return `experiment = ${new StoreQueryBuilder().escapeValue(experimentId)}`;
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
