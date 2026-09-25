import { Injectable, Inject, Logger } from "@nestjs/common";

import { isDecimalType, isNumericType } from "@repo/api/transforms/column-type-utils";

import type {
  AggregationSpec,
  FilterCondition,
} from "../../../common/modules/databricks/services/query-builder/query-builder.types";
import { FlattenedFields } from "../../../common/modules/databricks/services/query-builder/schema/flattened-fields";
import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { Result, success, failure, AppError, tryCatch } from "../../../common/utils/fp-utils";
import { ContributorAnonymizerService } from "../../application/services/contributor-anonymizer.service";
import {
  MACRO_TABLE_CONFIG,
  STATIC_TABLE_CONFIG,
  UPLOAD_TABLE_CONFIG,
  VARIANT_COLUMN_SUFFIX,
} from "../models/experiment-data.model";
import type {
  ExperimentTableMetadata,
  ExperimentTableType,
  SchemaDataDto,
  TableDataDto,
  VariantColumn,
} from "../models/experiment-data.model";
import { ExperimentDto } from "../models/experiment.model";
import { CACHE_PORT, SCHEMA_CACHE_PORT } from "../ports/cache.port";
import type { CachePort } from "../ports/cache.port";
import { DATABRICKS_PORT } from "../ports/databricks.port";
import type { DatabricksPort } from "../ports/databricks.port";

type ReadMode =
  | "aggregation"
  | "filtered-page"
  | "filtered-page-late-payload"
  | "filtered-all"
  | "page"
  | "page-late-payload";

interface ReadTrace {
  experimentId: string;
  tableName: string;
  mode: ReadMode;
  startedAt: number;
  metadataMs: number;
  countMs?: number;
  idsMs?: number;
  dataMs?: number;
  droppedRows?: number;
}

/** One page of a table: what it shows, how it is narrowed and sorted, and where it starts. */
interface PageQuery {
  columns?: string[];
  filters?: FilterCondition[];
  orderBy?: string;
  orderDirection: "ASC" | "DESC";
  limit: number;
  offset: number;
}

/**
 * Above this many rows a page is picked by id before its rows are read in full. The extra round
 * trip costs a second or two, while a single statement extracts the payload of every row before
 * its LIMIT, which costs more than that on tables of a few hundred thousand rows.
 */
const LATE_PAYLOAD_MIN_ROWS = 200_000;

/** The row id every payload view carries. */
const ROW_ID = "id";

/** What a read of one table flattens and hides, and the names its base columns hold. */
interface TableShape {
  metadata: ExperimentTableMetadata;
  variants: { columnName: VariantColumn; schema: string; suffix: string }[];
  exceptColumns: string[];
  reservedColumns: string[];
}

type RenamedColumns = Map<string, { name: string; source: VariantColumn }>;

@Injectable()
export class ExperimentDataRepository {
  private readonly logger = new Logger(ExperimentDataRepository.name);

  /**
   * Reads already running, keyed by their SQL. A second tab, a refetch or two charts asking the
   * same question join the running statement instead of queueing a copy behind it.
   */
  private readonly readsInFlight = new Map<string, Promise<Result<SchemaData>>>();

  constructor(
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
    @Inject(CACHE_PORT) private readonly cachePort: CachePort,
    @Inject(SCHEMA_CACHE_PORT) private readonly schemaCache: CachePort,
    private readonly contributorAnonymizer: ContributorAnonymizerService,
  ) {}

  /**
   * Get table data. Behaviour depends on which fields the caller sets:
   *   - `aggregation`: one-page summary (page/pageSize ignored).
   *   - `filters`/`columns` + `page`+`pageSize`: paginated read with an
   *     explicit COUNT over the filtered set, so the table widget can
   *     keep navigating pages after a filter is applied.
   *   - `filters`/`columns` without `page`: all matching rows in one page
   *     (chart consumers that need the full series).
   *   - none of the above: plain paginated read using the cached row count.
   */
  async getTableData(params: {
    experimentId: string;
    experiment: ExperimentDto;
    tableName: string;
    columns?: string[];
    filters?: FilterCondition[];
    aggregation?: AggregationSpec;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
    limit?: number;
  }): Promise<Result<TableDataDto[]>> {
    const {
      experimentId,
      experiment,
      tableName,
      columns,
      filters,
      aggregation,
      orderBy,
      orderDirection = "ASC",
      page,
      pageSize,
      limit,
    } = params;

    const read: ReadTrace = {
      experimentId,
      tableName,
      mode: "page",
      startedAt: performance.now(),
      metadataMs: 0,
    };

    const [shapeResult, metadataMs] = await this.measure(() =>
      this.tableShape(experimentId, tableName),
    );
    read.metadataMs = metadataMs;

    if (shapeResult.isFailure()) {
      return shapeResult;
    }

    const shape = shapeResult.value;
    const hasAggregation =
      (aggregation?.groupBy?.length ?? 0) > 0 || (aggregation?.functions?.length ?? 0) > 0;
    const hasFilters = (filters?.length ?? 0) > 0;
    const hasColumns = Boolean(columns && columns.length > 0);
    const hasPaging = page !== undefined && pageSize !== undefined;

    // When the experiment anonymizes contributors, the filter picker selects
    // pseudonyms; tag contributor id filters so the SQL compares the pseudonym
    // (recomputed in-query) instead of the raw id the client never receives.
    const effectiveFilters = this.pseudonymizeContributorFilters(experiment, filters);

    // Aggregation summary: page/pageSize ignored, `limit` caps the result.
    if (hasAggregation) {
      read.mode = "aggregation";
      const queryResult = this.buildQuery(experimentId, shape, {
        filters: effectiveFilters,
        aggregation,
        orderBy,
        orderDirection,
        limit,
      });
      if (queryResult.isFailure()) {
        return queryResult;
      }
      return this.getFullTableData({
        tableName,
        experiment,
        shape,
        query: queryResult.value,
        read,
      });
    }

    // Filters or column projection requested.
    if (hasFilters || hasColumns) {
      if (hasPaging) {
        read.mode = "filtered-page";
        const offset = (page - 1) * pageSize;

        // COUNT(*) over the unpaged filter query.
        const countSubqueryResult = this.buildQuery(experimentId, shape, {
          columns,
          filters: effectiveFilters,
        });
        if (countSubqueryResult.isFailure()) {
          return countSubqueryResult;
        }
        const countSql = `SELECT COUNT(*) AS total FROM (${countSubqueryResult.value}) AS sub`;

        const [[countResult, countMs], pageResult] = await Promise.all([
          this.measure(() => this.executeQuery(countSql)),
          this.pageData(experimentId, shape, read, {
            columns,
            filters: effectiveFilters,
            orderBy,
            orderDirection,
            limit: pageSize,
            offset,
          }),
        ]);
        read.countMs = countMs;
        if (countResult.isFailure()) {
          return countResult;
        }
        if (pageResult.isFailure()) {
          return pageResult;
        }
        this.logRead(read, pageResult.value);

        const totalRows = Number(countResult.value.rows[0]?.[0] ?? 0);
        return success([
          this.tablePage({
            tableName,
            experiment,
            shape,
            page,
            pageSize,
            rowCount: totalRows,
            data: pageResult.value,
          }),
        ]);
      }

      // Chart-style: all matching rows in one page, capped by `limit`.
      read.mode = "filtered-all";
      const queryResult = this.buildQuery(experimentId, shape, {
        columns,
        filters: effectiveFilters,
        orderBy,
        orderDirection,
        limit,
      });
      if (queryResult.isFailure()) {
        return queryResult;
      }
      return this.getFullTableData({
        tableName,
        experiment,
        shape,
        query: queryResult.value,
        read,
      });
    }

    // Plain paginated read (no filters, no aggregation, no projection).
    const usedPage = page ?? 1;
    const usedPageSize = pageSize ?? 5;
    const offset = (usedPage - 1) * usedPageSize;
    const pageResult = await this.pageData(experimentId, shape, read, {
      orderBy,
      orderDirection,
      limit: usedPageSize,
      offset,
    });
    if (pageResult.isFailure()) {
      return pageResult;
    }
    this.logRead(read, pageResult.value);

    return success([
      this.tablePage({
        tableName,
        experiment,
        shape,
        page: usedPage,
        pageSize: usedPageSize,
        rowCount: shape.metadata.rowCount,
        data: pageResult.value,
      }),
    ]);
  }

  /**
   * Distinct values for one column, capped at `limit`. NULLs are stripped
   * server-side so the picker doesn't surface a `(null)` entry.
   */
  async getDistinctColumnValues(params: {
    experimentId: string;
    experiment: ExperimentDto;
    tableName: string;
    column: string;
    limit: number;
  }): Promise<Result<{ values: (string | number)[]; truncated: boolean }>> {
    const { experimentId, experiment, tableName, column, limit } = params;

    const shapeResult = await this.tableShape(experimentId, tableName);
    if (shapeResult.isFailure()) {
      return shapeResult;
    }

    const queryResult = this.buildQuery(experimentId, shapeResult.value, {
      columns: [column],
      distinct: true,
      orderBy: column,
      orderDirection: "ASC",
      // +1 so we can detect truncation: if the SQL returned exactly limit+1
      // rows, the column has more values than we returned.
      limit: limit + 1,
    });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    const dataResult = await this.executeQuery(queryResult.value);
    if (dataResult.isFailure()) {
      return dataResult;
    }

    // Truncation is detected from the raw fetched count (query asked for
    // limit + 1): null/empty filtering below must not influence it.
    const truncated = dataResult.value.rows.length > limit;

    // SchemaData.rows is `(string | null)[][]`; single-column response means
    // each row is `[value]`. Drop nulls/blanks so the picker doesn't surface
    // a `(null)` entry.
    const raw = dataResult.value.rows
      .map((row) => row[0])
      .filter((v): v is string => v != null && v !== "");
    const trimmed = raw.slice(0, limit);

    // Coerce to a number only when the column's own type is numeric, so a
    // string column with numeric-looking codes (e.g. "007") keeps its form.
    const columnType = dataResult.value.columns[0]?.type_text;
    const isNumericColumn = isNumericType(columnType) || isDecimalType(columnType);
    const coerced: (string | number)[] = trimmed.map((v) => {
      if (!isNumericColumn) {
        return v;
      }
      const n = Number(v);
      return Number.isFinite(n) && v.trim() !== "" ? n : v;
    });

    const values = this.contributorAnonymizer.anonymizeDistinctValues(
      coerced,
      columnType,
      experiment,
    );

    return success({ values, truncated });
  }

  /**
   * The columns a read of the table returns. Columns only arrive or leave with a new schema
   * revision, so the answer is cached per revision and rows landing in the table do not re-run
   * the statement.
   */
  async getTableColumns(params: {
    experimentId: string;
    tableName: string;
  }): Promise<Result<SchemaDataDto["columns"]>> {
    const { experimentId, tableName } = params;

    const shapeResult = await this.tableShape(experimentId, tableName);
    if (shapeResult.isFailure()) {
      return shapeResult;
    }

    const shape = shapeResult.value;
    const queryResult = this.buildQuery(experimentId, shape, { limit: 1 });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    const revision = shape.metadata.schemaRevision ?? "";
    const cacheKey = `table-columns:${experimentId}:${tableName}:${revision}`;
    return tryCatch(async () => {
      const columns = await this.cachePort.tryCache(cacheKey, async () => {
        const dataResult = await this.executeQuery(queryResult.value);
        if (dataResult.isFailure()) {
          throw dataResult.error;
        }
        return this.describeColumns(dataResult.value.columns, shape);
      });
      return columns ?? [];
    });
  }

  /**
   * Schemas, row count and newest row of every table in an experiment, as one
   * cached snapshot. Reads build their SQL from it and the tables listing
   * serves it, so a count the page has seen is the count its next read uses.
   * A failed lookup is thrown through the cache so it is never stored, and
   * callers sharing the in-flight load all see the failure.
   */
  tablesMetadata(experimentId: string): Promise<Result<ExperimentTableMetadata[]>> {
    return tryCatch(async () => {
      const rows = await this.cachePort.tryCache(
        this.tablesMetadataCacheKey(experimentId),
        async () => {
          const result = await this.databricksPort.getExperimentTableMetadata(experimentId, {
            includeSchemas: true,
          });
          if (result.isFailure()) {
            throw result.error;
          }
          return result.value;
        },
      );
      return rows ?? [];
    });
  }

  private tablesMetadataCacheKey(experimentId: string): string {
    return `table-metadata:${experimentId}`;
  }

  private async tableMetadata(
    experimentId: string,
    tableName: string,
  ): Promise<Result<ExperimentTableMetadata[]>> {
    const result = await this.tablesMetadata(experimentId);
    if (result.isFailure()) {
      return result;
    }
    return success(result.value.filter((table) => table.identifier === tableName));
  }

  /**
   * Tag contributor id filters so the query compares the pseudonym (recomputed
   * in SQL) instead of the raw id. The picker sends pseudonyms when the
   * experiment anonymizes (see `anonymizeDistinctValues`); this lets them match
   * without the real id ever reaching the client. The FE routes contributor
   * filters through a `<column>.id` struct path (its only producer of one).
   */
  private pseudonymizeContributorFilters(
    experiment: ExperimentDto,
    filters?: FilterCondition[],
  ): FilterCondition[] | undefined {
    if (!experiment.anonymizeContributors || !filters) {
      return filters;
    }

    return filters.map((f) =>
      /^[^.]+\.id$/.test(f.column) ? { ...f, contributorPseudonymSalt: experiment.id } : f,
    );
  }

  /**
   * The table's metadata, what a read of it flattens and hides, and the names its base columns
   * hold. The view's columns are looked up only when a payload is flattened, since only then can
   * a field's name clash with one of them.
   */
  private async tableShape(experimentId: string, tableName: string): Promise<Result<TableShape>> {
    const metadataResult = await this.tableMetadata(experimentId, tableName);
    if (metadataResult.isFailure()) {
      return metadataResult;
    }
    if (metadataResult.value.length === 0) {
      return failure(AppError.notFound(`Table '${tableName}' not found in experiment`));
    }

    const metadata = metadataResult.value[0];
    const {
      identifier,
      tableType,
      macroSchema,
      questionsSchema,
      customMetadataSchema,
      uploadSchema,
    } = metadata;

    const config = (() => {
      if (tableType === "macro") {
        return MACRO_TABLE_CONFIG;
      }
      if (tableType === "upload") {
        return UPLOAD_TABLE_CONFIG;
      }
      return STATIC_TABLE_CONFIG[identifier];
    })();

    if (!config) {
      return failure(
        AppError.internal(
          `No table configuration found for static table '${identifier}'`,
          "UNKNOWN_TABLE_CONFIG",
        ),
      );
    }

    const exceptColumns = [...config.exceptColumns];
    const variants: TableShape["variants"] = [];

    if (config.variantColumns.includes("macro_output")) {
      if (macroSchema) {
        variants.push({
          columnName: "macro_output",
          schema: macroSchema,
          suffix: VARIANT_COLUMN_SUFFIX.macro_output,
        });
      } else {
        exceptColumns.push("macro_output");
      }
    }

    if (config.variantColumns.includes("questions_data")) {
      if (questionsSchema) {
        variants.push({
          columnName: "questions_data",
          schema: questionsSchema,
          suffix: VARIANT_COLUMN_SUFFIX.questions_data,
        });
      } else {
        exceptColumns.push("questions_data");
      }
    }

    if (config.variantColumns.includes("custom_metadata")) {
      if (customMetadataSchema) {
        variants.push({
          columnName: "custom_metadata",
          schema: customMetadataSchema,
          suffix: VARIANT_COLUMN_SUFFIX.custom_metadata,
        });
      } else {
        exceptColumns.push("custom_metadata");
      }
    }

    if (config.variantColumns.includes("uploaded_data")) {
      if (uploadSchema) {
        variants.push({
          columnName: "uploaded_data",
          schema: uploadSchema,
          suffix: VARIANT_COLUMN_SUFFIX.uploaded_data,
        });
      } else {
        exceptColumns.push("uploaded_data");
      }
    }

    if (variants.length === 0) {
      return success({ metadata, variants, exceptColumns, reservedColumns: [] });
    }

    const viewColumnsResult = await this.viewColumns(tableType, identifier);
    if (viewColumnsResult.isFailure()) {
      return viewColumnsResult;
    }

    const hidden = new Set<string>([...config.variantColumns, ...exceptColumns]);
    const reservedColumns = viewColumnsResult.value.filter((column) => !hidden.has(column));
    return success({ metadata, variants, exceptColumns, reservedColumns });
  }

  /** A view's columns change only when it is redefined, so they come from the long-lived cache. */
  private viewColumns(
    tableType: ExperimentTableType,
    identifier: string,
  ): Promise<Result<string[]>> {
    // Macro and upload tables each read one shared view; every static table has its own.
    const view = tableType === "static" ? `static:${identifier}` : tableType;
    return tryCatch(async () => {
      const columns = await this.schemaCache.tryCache(`view-columns:${view}`, async () => {
        const result = await this.databricksPort.getExperimentTableColumns(tableType, identifier);
        if (result.isFailure()) {
          throw result.error;
        }
        return result.value;
      });
      return columns ?? [];
    });
  }

  private buildQuery(
    experimentId: string,
    shape: TableShape,
    options: {
      columns?: string[];
      filters?: FilterCondition[];
      aggregation?: AggregationSpec;
      distinct?: boolean;
      orderBy?: string;
      orderDirection?: "ASC" | "DESC";
      limit?: number;
      offset?: number;
    } = {},
  ): Result<string> {
    const { columns, filters, aggregation, distinct, orderBy, orderDirection, limit, offset } =
      options;
    const { metadata, variants, exceptColumns, reservedColumns } = shape;

    return this.databricksPort.buildExperimentQuery({
      tableName: metadata.identifier,
      tableType: metadata.tableType,
      experimentId,
      columns,
      variants: variants.length > 0 ? variants : undefined,
      reservedColumns: reservedColumns.length > 0 ? reservedColumns : undefined,
      exceptColumns: exceptColumns.length > 0 ? exceptColumns : undefined,
      filters,
      aggregation,
      distinct,
      orderBy,
      orderDirection,
      limit,
      offset,
    });
  }

  /** Result columns a name clash renamed, keyed by the name they read as. */
  private renamedColumns(shape: TableShape): RenamedColumns {
    const sources = shape.variants.map(({ columnName, schema, suffix }) => ({
      column: columnName,
      schema,
      suffix,
    }));
    const renamed = FlattenedFields.resolve(shape.reservedColumns, sources).filter(
      ({ key, field }) => key !== field.name,
    );
    return new Map(
      renamed.map(({ key, column, field }) => [key, { name: field.name, source: column }]),
    );
  }

  private executeQuery(query: string): Promise<Result<SchemaData>> {
    const running = this.readsInFlight.get(query);
    if (running !== undefined) {
      return running;
    }

    const read = this.runQuery(query).finally(() => this.readsInFlight.delete(query));
    this.readsInFlight.set(query, read);
    return read;
  }

  /**
   * Execute a generated SQL; on failure log the SQL too, since errors like
   * `UNRESOLVED_COLUMN` depend on the exact compiled query.
   */
  private async runQuery(query: string): Promise<Result<SchemaData>> {
    const dataResult = await this.databricksPort.executeSqlQuery(
      this.databricksPort.CENTRUM_SCHEMA_NAME,
      query,
    );
    if (dataResult.isFailure()) {
      this.logger.error({
        msg: "Experiment data query failed",
        sql: query,
        error: dataResult.error.message,
      });
    }
    return dataResult;
  }

  private async getFullTableData(params: {
    tableName: string;
    experiment: ExperimentDto;
    shape: TableShape;
    query: string;
    read: ReadTrace;
  }): Promise<Result<TableDataDto[]>> {
    const { tableName, experiment, shape, query, read } = params;

    const [dataResult, dataMs] = await this.measure(() => this.executeQuery(query));
    read.dataMs = dataMs;
    if (dataResult.isFailure()) {
      return dataResult;
    }
    this.logRead(read, dataResult.value);

    const totalRows = dataResult.value.totalRows;

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: this.databricksPort.CENTRUM_SCHEMA_NAME,
        data: this.transformSchemaData(dataResult.value, experiment, shape),
        page: 1,
        pageSize: totalRows,
        totalRows,
        totalPages: 1,
      },
    ]);
  }

  /**
   * One page of rows. On a large table the page is first picked by row id over only the columns
   * its filters and sort need, and just those rows are then read in full, because one statement
   * would extract the payload of every row before its LIMIT. A page that picks no ids is read as
   * one statement, so an empty page still carries the table's columns.
   */
  private async pageData(
    experimentId: string,
    shape: TableShape,
    read: ReadTrace,
    page: PageQuery,
  ): Promise<Result<SchemaData>> {
    if (!this.readsPayloadLate(shape, page.columns)) {
      return this.singleStatementPage(experimentId, shape, read, page);
    }

    const idsQuery = this.buildQuery(experimentId, shape, { ...page, columns: [ROW_ID] });
    if (idsQuery.isFailure()) {
      return idsQuery;
    }

    const [idsResult, idsMs] = await this.measure(() => this.executeQuery(idsQuery.value));
    read.idsMs = idsMs;
    if (idsResult.isFailure()) {
      return idsResult;
    }

    const ids = idsResult.value.rows.flatMap(([id]) => (id === null ? [] : [id]));
    if (ids.length === 0) {
      return this.singleStatementPage(experimentId, shape, read, page);
    }

    read.mode = read.mode === "filtered-page" ? "filtered-page-late-payload" : "page-late-payload";
    // Ids go as strings: a quoted literal compares exactly against an INT or BIGINT id, and upload
    // ids pass 2^53, which a JavaScript number cannot hold.
    const rowsQuery = this.buildQuery(experimentId, shape, {
      columns: page.columns,
      filters: [{ column: ROW_ID, operator: "in", value: [...new Set(ids)] }],
    });
    if (rowsQuery.isFailure()) {
      return rowsQuery;
    }

    const [rowsResult, dataMs] = await this.measure(() => this.executeQuery(rowsQuery.value));
    read.dataMs = dataMs;
    if (rowsResult.isFailure()) {
      return rowsResult;
    }

    return success(this.orderByIds(ids, rowsResult.value, read));
  }

  private async singleStatementPage(
    experimentId: string,
    shape: TableShape,
    read: ReadTrace,
    page: PageQuery,
  ): Promise<Result<SchemaData>> {
    const queryResult = this.buildQuery(experimentId, shape, page);
    if (queryResult.isFailure()) {
      return queryResult;
    }

    const [dataResult, dataMs] = await this.measure(() => this.executeQuery(queryResult.value));
    read.dataMs = dataMs;
    return dataResult;
  }

  /** Only a large table with a payload gains from the second step, which matches rows by id. */
  private readsPayloadLate(shape: TableShape, columns?: string[]): boolean {
    const isLargeTable = shape.metadata.rowCount > LATE_PAYLOAD_MIN_ROWS;
    const hasPayload = shape.variants.length > 0;
    const carriesRowId = columns === undefined || columns.length === 0 || columns.includes(ROW_ID);
    return isLargeTable && hasPayload && carriesRowId;
  }

  /**
   * The page's rows in the order their ids were picked, one row per picked id. A row outside the
   * page that shares an id comes back too; it is dropped and counted.
   */
  private orderByIds(ids: string[], data: SchemaData, read: ReadTrace): SchemaData {
    const idIndex = data.columns.findIndex(({ name }) => name === ROW_ID);
    const rowsById = new Map<string, SchemaData["rows"]>();
    for (const row of data.rows) {
      const id = row[idIndex];
      if (id !== null) {
        rowsById.set(id, [...(rowsById.get(id) ?? []), row]);
      }
    }

    const rows = ids.flatMap((id) => {
      const row = rowsById.get(id)?.shift();
      return row === undefined ? [] : [row];
    });
    read.droppedRows = data.rows.length - rows.length;
    return { ...data, rows, totalRows: rows.length };
  }

  private tablePage(params: {
    tableName: string;
    experiment: ExperimentDto;
    shape: TableShape;
    page: number;
    pageSize: number;
    rowCount: number;
    data: SchemaData;
  }): TableDataDto {
    const { tableName, experiment, shape, page, pageSize, rowCount, data } = params;
    return {
      name: tableName,
      catalog_name: experiment.name,
      schema_name: this.databricksPort.CENTRUM_SCHEMA_NAME,
      data: this.transformSchemaData(data, experiment, shape),
      page,
      pageSize,
      totalRows: rowCount,
      totalPages: Math.ceil(rowCount / pageSize),
    };
  }

  private async measure<T>(run: () => Promise<T>): Promise<[T, number]> {
    const startedAt = performance.now();
    const value = await run();
    return [value, Math.round(performance.now() - startedAt)];
  }

  /** One line per read with the warehouse phases split out, so a slow chart names its phase. */
  private logRead(read: ReadTrace, data: SchemaData): void {
    this.logger.log({
      msg: "Experiment data read",
      operation: "getTableData",
      experimentId: read.experimentId,
      tableName: read.tableName,
      mode: read.mode,
      metadataMs: read.metadataMs,
      countMs: read.countMs,
      idsMs: read.idsMs,
      dataMs: read.dataMs,
      droppedRows: read.droppedRows,
      totalMs: Math.round(performance.now() - read.startedAt),
      rows: data.rows.length,
      totalRows: data.totalRows,
      truncated: data.truncated,
    });
  }

  /**
   * Convert schema data to DTO, tag the columns a name clash renamed, and route every row
   * through the contributor anonymiser; the single seat for that policy.
   */
  /** A read's columns, each renamed payload field carrying its own name and where it came from. */
  private describeColumns(
    columns: SchemaData["columns"],
    shape: TableShape,
  ): SchemaDataDto["columns"] {
    const renamed = this.renamedColumns(shape);
    return columns.map((column) => {
      const renamedFrom = renamed.get(column.name);
      return renamedFrom === undefined ? column : { ...column, renamedFrom };
    });
  }

  private transformSchemaData(
    schemaData: SchemaData,
    experiment: ExperimentDto,
    shape: TableShape,
  ): SchemaDataDto {
    const columns = this.describeColumns(schemaData.columns, shape);

    const rows = schemaData.rows.map((row) => {
      const dataRow: Record<string, string | null> = {};
      row.forEach((value, index) => {
        dataRow[schemaData.columns[index].name] = value;
      });
      return dataRow;
    });
    return {
      columns,
      rows: this.contributorAnonymizer.anonymizeRows(rows, schemaData.columns, experiment),
      totalRows: schemaData.totalRows,
      truncated: schemaData.truncated,
    };
  }
}
