import { Injectable, Inject, Logger } from "@nestjs/common";

import {
  takesWindow,
  DATA_QUERY_MAX_LIMIT,
  WellKnownColumnTypes,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataJoin } from "@repo/api/domains/experiment/data/experiment-data.schema";
import {
  getColumnKind,
  isDecimalType,
  isNumericType,
} from "@repo/api/transforms/column-type-utils";
import { isJoinMatchColumn, joinedColumns } from "@repo/api/transforms/joined-columns";

import { SqlQueryBuilder } from "../../../common/modules/databricks/services/query-builder/query-builder.base";
import type {
  AggregationSpec,
  FilterCondition,
  QueryOrdering,
} from "../../../common/modules/databricks/services/query-builder/query-builder.types";
import type { FlattenedField } from "../../../common/modules/databricks/services/query-builder/schema/flattened-fields";
import { FlattenedFields } from "../../../common/modules/databricks/services/query-builder/schema/flattened-fields";
import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { ErrorCodes } from "../../../common/utils/error-codes";
import { Result, success, failure, AppError, tryCatch } from "../../../common/utils/fp-utils";
import { ContributorAnonymizerService } from "../../application/services/contributor-anonymizer.service";
import { ExperimentStoreReadsService } from "../../application/services/experiment-store-reads.service";
import { ExperimentWarehouseReadsService } from "../../application/services/experiment-warehouse-reads.service";
import { PlatformAnnotationsService } from "../../application/services/platform-annotations.service";
import {
  MACRO_TABLE_CONFIG,
  PAGE_TOO_LARGE_MESSAGE,
  STATIC_TABLE_CONFIG,
  UPLOAD_TABLE_CONFIG,
  VARIANT_COLUMN_SUFFIX,
} from "../models/experiment-data.model";
import type {
  ExperimentAsOfJoin,
  ExperimentDataSource,
  ExperimentQueryParams,
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
import type { ExperimentTableReads, TableQuery } from "../ports/experiment-table-reads.port";

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
  source: ExperimentDataSource;
  mode: ReadMode;
  startedAt: number;
  metadataMs: number;
  countMs?: number;
  idsMs?: number;
  dataMs?: number;
  annotationsMs?: number;
  droppedRows?: number;
}

/** One page of a table: what it shows, how it is narrowed and sorted, and where it starts. */
interface PageQuery {
  columns?: string[];
  filters?: FilterCondition[];
  ordering?: QueryOrdering;
  limit: number;
  offset: number;
}

/** A read's filters and sort once an anonymized experiment's contributors are behind pseudonyms. */
interface AnonymizedQuery {
  filters?: FilterCondition[];
  ordering?: QueryOrdering;
}

/**
 * Above this many rows a page is picked by id before its rows are read in full. The extra round
 * trip costs a second or two, while a single statement extracts the payload of every row before
 * its LIMIT, which costs more than that on tables of a few hundred thousand rows.
 */
const LATE_PAYLOAD_MIN_ROWS = 200_000;

/** The row id every payload view carries. */
const ROW_ID = "id";

const ANNOTATIONS = "annotations";

/** What a read of one table flattens and hides, and the names its base columns hold. */
interface TableShape {
  source: ExperimentDataSource;
  columns?: SchemaDataDto["columns"];
  join?: ExperimentAsOfJoin;
  metadata: ExperimentTableMetadata;
  variants: { columnName: VariantColumn; schema: string; suffix: string }[];
  exceptColumns: string[];
  reservedColumns: string[];
  baseColumns?: string[];
  /**
   * The column a read's phone annotations come from: the store's own annotations, the warehouse
   * view's payload_annotations, or none, as on an upload table. The platform's come from Postgres.
   */
  phoneAnnotationsFrom?: string;
}

type RenamedColumns = Map<string, { name: string; source: VariantColumn }>;

@Injectable()
export class ExperimentDataRepository {
  private readonly logger = new Logger(ExperimentDataRepository.name);

  /**
   * Reads already running, keyed by their source and query. A second tab, a refetch or two charts
   * asking the same question join the running statement instead of queueing a copy behind it.
   */
  private readonly readsInFlight = new Map<string, Promise<Result<SchemaData>>>();

  constructor(
    @Inject(DATABRICKS_PORT) private readonly databricksPort: DatabricksPort,
    @Inject(CACHE_PORT) private readonly cachePort: CachePort,
    @Inject(SCHEMA_CACHE_PORT) private readonly schemaCache: CachePort,
    private readonly contributorAnonymizer: ContributorAnonymizerService,
    private readonly platformAnnotations: PlatformAnnotationsService,
    private readonly warehouseReads: ExperimentWarehouseReadsService,
    private readonly storeReads: ExperimentStoreReadsService,
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
   *
   * The two one-page reads stop at `limit`, or `DATA_QUERY_MAX_LIMIT` when it is omitted, and
   * say when they stopped short. They feed charts, which read from the warehouse until the store
   * aggregates, whatever `source` says, as does a read joined to a second table.
   */
  async getTableData(params: {
    experimentId: string;
    experiment: ExperimentDto;
    tableName: string;
    columns?: string[];
    filters?: FilterCondition[];
    aggregation?: AggregationSpec;
    join?: ExperimentDataJoin;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
    limit?: number;
    source: ExperimentDataSource;
  }): Promise<Result<TableDataDto[]>> {
    const {
      experimentId,
      experiment,
      tableName,
      columns,
      filters,
      aggregation,
      join,
      orderBy,
      orderDirection = "ASC",
      page,
      pageSize,
      limit,
      source,
    } = params;

    const hasAggregation =
      (aggregation?.groupBy?.length ?? 0) > 0 || (aggregation?.functions?.length ?? 0) > 0;
    const hasFilters = (filters?.length ?? 0) > 0;
    const hasColumns = join !== undefined || (columns?.length ?? 0) > 0;
    const hasPaging = page !== undefined && pageSize !== undefined;
    const ceiling = limit ?? DATA_QUERY_MAX_LIMIT;
    const isChartRead = hasAggregation || ((hasFilters || hasColumns) && !hasPaging);
    const readSource = isChartRead || join !== undefined ? "warehouse" : source;

    const read: ReadTrace = {
      experimentId,
      tableName,
      source: readSource,
      mode: "page",
      startedAt: performance.now(),
      metadataMs: 0,
    };

    const [shapeResult, metadataMs] = await this.measure(() =>
      this.tableShape(experimentId, tableName, readSource),
    );
    read.metadataMs = metadataMs;

    if (shapeResult.isFailure()) {
      return shapeResult;
    }

    let shape = shapeResult.value;
    read.source = shape.source;
    if (join) {
      const joined = await this.joinedShape(experimentId, tableName, shape, join);
      if (joined.isFailure()) return joined;
      shape = joined.value;
    }

    const anonymizedResult = await this.anonymizedQuery(experiment, tableName, shape.source, {
      columns,
      filters,
      aggregation,
      orderBy,
      orderDirection,
      join,
    });
    if (anonymizedResult.isFailure()) {
      return anonymizedResult;
    }

    const { filters: effectiveFilters, ordering } = anonymizedResult.value;

    // Aggregation summary: page/pageSize ignored.
    if (hasAggregation) {
      read.mode = "aggregation";
      const queryResult = await this.buildQuery(experimentId, shape, {
        filters: effectiveFilters,
        aggregation,
        ordering,
        limit: ceiling + 1,
      });
      if (queryResult.isFailure()) {
        return queryResult;
      }
      const countSubqueryResult = await this.buildQuery(experimentId, shape, {
        filters: effectiveFilters,
        aggregation,
      });
      if (countSubqueryResult.isFailure()) {
        return countSubqueryResult;
      }
      return this.getFullTableData({
        tableName,
        experiment,
        shape,
        query: queryResult.value,
        countQuery: this.reads(shape).countQuery(countSubqueryResult.value),
        ceiling,
        read,
      });
    }

    // Filters or column projection requested.
    if (hasFilters || hasColumns) {
      if (hasPaging) {
        read.mode = "filtered-page";
        const offset = (page - 1) * pageSize;

        // COUNT(*) over the unpaged filter query.
        const countSubqueryResult = await this.buildQuery(experimentId, shape, {
          columns,
          filters: effectiveFilters,
        });
        if (countSubqueryResult.isFailure()) {
          return countSubqueryResult;
        }
        const countQuery = this.reads(shape).countQuery(countSubqueryResult.value);

        const [[countResult, countMs], pageResult] = await Promise.all([
          this.measure(() => this.executeQuery(shape, countQuery)),
          this.pageData(experimentId, shape, read, {
            columns,
            filters: effectiveFilters,
            ordering,
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
        if (pageResult.value.truncated) {
          return this.pageTooLarge();
        }
        const filled = await this.withPlatformAnnotations(read, shape, pageResult.value);
        if (filled.isFailure()) {
          return filled;
        }

        const totalRows = Number(countResult.value.rows[0]?.[0] ?? 0);
        return success([
          this.tablePage({
            tableName,
            experiment,
            shape,
            page,
            pageSize,
            rowCount: totalRows,
            data: filled.value,
          }),
        ]);
      }

      // Chart-style: all matching rows in one page.
      read.mode = "filtered-all";
      const queryResult = await this.buildQuery(experimentId, shape, {
        columns,
        filters: effectiveFilters,
        ordering,
        limit: ceiling + 1,
      });
      if (queryResult.isFailure()) {
        return queryResult;
      }
      const countSubqueryResult = await this.buildQuery(experimentId, shape, {
        columns,
        filters: effectiveFilters,
      });
      if (countSubqueryResult.isFailure()) {
        return countSubqueryResult;
      }
      return this.getFullTableData({
        tableName,
        experiment,
        shape,
        query: queryResult.value,
        countQuery: this.reads(shape).countQuery(countSubqueryResult.value),
        ceiling,
        read,
      });
    }

    // Plain paginated read (no filters, no aggregation, no projection).
    const usedPage = page ?? 1;
    const usedPageSize = pageSize ?? 5;
    const offset = (usedPage - 1) * usedPageSize;
    const pageResult = await this.pageData(experimentId, shape, read, {
      ordering,
      limit: usedPageSize,
      offset,
    });
    if (pageResult.isFailure()) {
      return pageResult;
    }
    if (pageResult.value.truncated) {
      return this.pageTooLarge();
    }
    const filled = await this.withPlatformAnnotations(read, shape, pageResult.value);
    if (filled.isFailure()) {
      return filled;
    }

    return success([
      this.tablePage({
        tableName,
        experiment,
        shape,
        page: usedPage,
        pageSize: usedPageSize,
        rowCount: shape.metadata.rowCount,
        data: filled.value,
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
    source: ExperimentDataSource;
    offset?: number;
  }): Promise<Result<{ values: (string | number)[]; truncated: boolean }>> {
    const { experimentId, experiment, tableName, column, limit, offset, source } = params;

    let shapeResult = await this.tableShape(experimentId, tableName, source);
    if (shapeResult.isFailure()) {
      return shapeResult;
    }

    // Device picker labels must match the charts they filter, which read from the warehouse.
    if (
      column === "device" &&
      shapeResult.value.metadata.tableType !== "upload" &&
      shapeResult.value.source === "store"
    ) {
      shapeResult = await this.tableShape(experimentId, tableName, "warehouse");
      if (shapeResult.isFailure()) {
        return shapeResult;
      }
    }
    const shape = shapeResult.value;
    const anonymizedResult = await this.anonymizedQuery(experiment, tableName, shape.source, {
      columns: [column],
      orderDirection: "ASC",
    });
    if (anonymizedResult.isFailure()) {
      return anonymizedResult;
    }
    const deviceColumn = column === "device" && shape.metadata.tableType !== "upload";
    if (!deviceColumn && (offset ?? 0) > 0) {
      return failure(AppError.badRequest("Offset paging is supported only for device columns"));
    }
    const queryResult = await (deviceColumn && shape.source === "warehouse"
      ? this.deviceValuesSql(experimentId, shape, limit, offset)
      : this.buildQuery(experimentId, shape, {
          columns: [column],
          distinct: true,
          ordering: { column, direction: "ASC" },
          limit: limit + 1,
          offset,
        }));
    if (queryResult.isFailure()) {
      return queryResult;
    }
    const dataResult = await this.executeQuery(shape, queryResult.value);
    if (dataResult.isFailure()) {
      return dataResult;
    }

    // Truncation is detected from the raw fetched count (query asked for
    // limit + 1): null/empty filtering below must not influence it. The
    // warehouse can also cut a result at its byte limit.
    const truncated = dataResult.value.rows.length > limit || dataResult.value.truncated;

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
    join?: ExperimentDataJoin;
    source: ExperimentDataSource;
  }): Promise<Result<SchemaDataDto["columns"]>> {
    const { experimentId, tableName, join, source } = params;
    if (join) {
      const shape = await this.tableShape(experimentId, tableName, "warehouse");
      if (shape.isFailure()) return shape;
      const joined = await this.joinedShape(experimentId, tableName, shape.value, join);
      if (joined.isFailure()) return joined;
      return success(joined.value.columns);
    }

    const shapeResult = await this.tableShape(experimentId, tableName, source);
    if (shapeResult.isFailure()) {
      return shapeResult;
    }

    const shape = shapeResult.value;
    const queryResult = await this.buildQuery(experimentId, shape, { limit: 1 });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    const revision = shape.metadata.schemaRevision ?? "";
    const cacheKey = `table-columns:${shape.source}:${experimentId}:${tableName}:${revision}`;
    return tryCatch(async () => {
      const columns = await this.cachePort.tryCache(cacheKey, async () => {
        const dataResult = await this.executeQuery(shape, queryResult.value);
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
  tablesMetadata(
    experimentId: string,
    source: ExperimentDataSource,
  ): Promise<Result<ExperimentTableMetadata[]>> {
    return tryCatch(async () => {
      const rows = await this.cachePort.tryCache(
        `table-metadata:${source}:${experimentId}`,
        async () => {
          const result = await this.sourceReads(source).tablesMetadata(experimentId);
          if (result.isFailure()) {
            throw result.error;
          }
          return result.value;
        },
      );
      return rows ?? [];
    });
  }

  private async tableMetadata(
    experimentId: string,
    tableName: string,
    source: ExperimentDataSource,
  ): Promise<Result<ExperimentTableMetadata[]>> {
    const result = await this.tablesMetadata(experimentId, source);
    if (result.isFailure()) {
      return result;
    }
    return success(result.value.filter((table) => table.identifier === tableName));
  }

  /**
   * Keep an anonymized experiment's contributors behind their pseudonyms. A read may name a
   * contributor column whole, since its cells are rewritten after the read; filter it by
   * `<column>.id`, compared as the pseudonym the picker sends; and sort by it, in the order of the
   * pseudonyms it shows. Any other field of it would return or match the real person, so the read
   * is refused. The column's type decides, so another struct's fields read as they are. An absent
   * `orderBy` or an empty string means no sort.
   */
  private async anonymizedQuery(
    experiment: ExperimentDto,
    tableName: string,
    source: ExperimentDataSource,
    query: {
      columns?: string[];
      filters?: FilterCondition[];
      aggregation?: AggregationSpec;
      orderBy?: string;
      orderDirection: "ASC" | "DESC";
      join?: ExperimentDataJoin;
    },
  ): Promise<Result<AnonymizedQuery>> {
    const { columns = [], filters, aggregation, orderBy, orderDirection: direction, join } = query;
    const ordering = orderBy ? { column: orderBy, direction } : undefined;
    const projected = [
      ...columns,
      ...(aggregation?.groupBy ?? []).map((group) => group.column),
      ...(aggregation?.functions ?? []).flatMap((fn) => [
        fn.column,
        ...(fn.secondColumn === undefined ? [] : [fn.secondColumn]),
        ...(fn.partitionColumn === undefined ? [] : [fn.partitionColumn]),
        ...(fn.orderColumn === undefined ? [] : [fn.orderColumn]),
      ]),
    ];
    const namesAColumn = projected.length > 0 || (filters?.length ?? 0) > 0 || Boolean(orderBy);
    if (!experiment.anonymizeContributors || !namesAColumn) {
      return success({ filters, ordering });
    }

    const columnsResult = await this.getTableColumns({
      experimentId: experiment.id,
      tableName,
      join,
      source,
    });
    if (columnsResult.isFailure()) {
      return columnsResult;
    }

    const referenceOf = (name: string) => this.contributorReference(name, columnsResult.value);

    const contributorOrder = aggregation?.functions?.find(
      (item) => item.orderColumn !== undefined && referenceOf(item.orderColumn) !== undefined,
    )?.orderColumn;
    if (contributorOrder !== undefined) return this.anonymizedRefusal(contributorOrder);

    const revealing = projected.find((name) => referenceOf(name)?.field !== undefined);
    if (revealing !== undefined) {
      return this.anonymizedRefusal(revealing);
    }

    const pseudonymFilters: FilterCondition[] = [];
    for (const filter of filters ?? []) {
      const reference = referenceOf(filter.column);
      if (reference === undefined) {
        pseudonymFilters.push(filter);
        continue;
      }
      if (reference.field !== "id") {
        return this.anonymizedRefusal(filter.column);
      }
      pseudonymFilters.push({ ...filter, contributorPseudonymSalt: experiment.id });
    }

    const effectiveFilters = filters === undefined ? undefined : pseudonymFilters;
    const sorted = ordering === undefined ? undefined : referenceOf(ordering.column);
    // With a join, a column named whole keeps its own order.
    const isJoinedColumn = join !== undefined && sorted?.field === undefined;
    if (ordering === undefined || sorted === undefined || isJoinedColumn) {
      return success({ filters: effectiveFilters, ordering });
    }
    const sortsByPseudonym =
      sorted.field === undefined || sorted.field === "id" || sorted.field === "name";
    if (!sortsByPseudonym) {
      return this.anonymizedRefusal(ordering.column);
    }

    return success({
      filters: effectiveFilters,
      ordering: {
        column: `${sorted.column}.id`,
        direction,
        mode: { kind: "pseudonym", salt: experiment.id },
      },
    });
  }

  /**
   * The contributor column a name reads and the field it reads of it, if it names one. The
   * warehouse resolves a name in any case, so a contributor column matches in any case too. A name
   * that is another column's own, such as a payload field with a dot in it, is that column, matched
   * exactly as the query builder matches it.
   */
  private contributorReference(
    name: string,
    columns: SchemaDataDto["columns"],
  ): { column: string; field?: string } | undefined {
    const contributorNamed = (candidate: string) =>
      columns.find(
        (column) =>
          column.name.toLowerCase() === candidate.toLowerCase() &&
          column.type_text === WellKnownColumnTypes.CONTRIBUTOR,
      )?.name;

    const whole = contributorNamed(name);
    if (whole !== undefined) {
      return { column: whole };
    }
    if (columns.some((column) => column.name === name)) {
      return undefined;
    }

    const dot = name.indexOf(".");
    const column = dot === -1 ? undefined : contributorNamed(name.slice(0, dot));
    return column === undefined ? undefined : { column, field: name.slice(dot + 1) };
  }

  private anonymizedRefusal(name: string): Result<never> {
    return failure(
      AppError.badRequest(
        `Contributors are anonymized in this experiment, so '${name}' cannot be read; ` +
          "filter a contributor column by its '.id' with the pseudonyms the table shows",
      ),
    );
  }

  /**
   * The table's metadata, what a read of it flattens and hides, and the names its base columns
   * hold. The view's columns also tell platform reads whether client_id is available
   * for device labels. Flattened payload fields reserve only visible base names.
   */
  private async tableShape(
    experimentId: string,
    tableName: string,
    requestedSource: ExperimentDataSource,
  ): Promise<Result<TableShape>> {
    const source = this.sourceReads(requestedSource).readsTable(tableName)
      ? requestedSource
      : "warehouse";
    const metadataResult = await this.tableMetadata(experimentId, tableName, source);
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
    const phoneAnnotationsFrom = source === "store" ? ANNOTATIONS : config.phoneAnnotationsColumn;

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

    if (variants.length === 0 && tableType === "upload") {
      return success({
        source,
        metadata,
        variants,
        exceptColumns,
        reservedColumns: [],
        phoneAnnotationsFrom,
      });
    }

    const viewColumnsResult = await this.viewColumns(source, tableType, identifier);
    if (viewColumnsResult.isFailure()) {
      return viewColumnsResult;
    }

    const deviceClientIdAvailable = viewColumnsResult.value.includes("client_id");
    if (!deviceClientIdAvailable && exceptColumns.includes("client_id")) {
      exceptColumns.splice(exceptColumns.indexOf("client_id"), 1);
    }
    const hidden = new Set<string>([...config.variantColumns, ...exceptColumns]);
    const reservedColumns =
      variants.length > 0 ? viewColumnsResult.value.filter((column) => !hidden.has(column)) : [];
    return success({
      source,
      metadata,
      variants,
      exceptColumns,
      reservedColumns,
      baseColumns: viewColumnsResult.value,
      phoneAnnotationsFrom,
    });
  }

  /** A view's columns change only when it is redefined, so they come from the long-lived cache. */
  private viewColumns(
    source: ExperimentDataSource,
    tableType: ExperimentTableType,
    identifier: string,
  ): Promise<Result<string[]>> {
    // Macro and upload tables each read one shared view; every static table has its own.
    const view = tableType === "static" ? `static:${identifier}` : tableType;
    return tryCatch(async () => {
      const columns = await this.schemaCache.tryCache(
        `view-columns:${source}:${view}`,
        async () => {
          const result = await this.sourceReads(source).viewColumns(tableType, identifier);
          if (result.isFailure()) {
            throw result.error;
          }
          return result.value;
        },
      );
      return columns ?? [];
    });
  }

  private async joinedShape(
    experimentId: string,
    tableName: string,
    shape: TableShape,
    join: ExperimentDataJoin,
  ): Promise<Result<TableShape & { columns: SchemaDataDto["columns"] }>> {
    if (join.tableName === tableName)
      return failure(AppError.badRequest("Choose a different second table"));
    const secondary = await this.tableShape(experimentId, join.tableName, "warehouse");
    if (secondary.isFailure()) return secondary;
    const primaryColumns = await this.getTableColumns({
      experimentId,
      tableName,
      source: "warehouse",
    });
    if (primaryColumns.isFailure()) return primaryColumns;
    const secondaryColumns = await this.getTableColumns({
      experimentId,
      tableName: join.tableName,
      source: "warehouse",
    });
    if (secondaryColumns.isFailure()) return secondaryColumns;
    const left = primaryColumns.value;
    const right = secondaryColumns.value;
    const matchLeft = left.find((c) => c.name === join.matchColumn);
    const matchRight = right.find((c) => c.name === join.matchColumn);
    if (
      !matchLeft ||
      !matchRight ||
      !isJoinMatchColumn(matchLeft) ||
      matchLeft.type_text.toUpperCase() !== matchRight.type_text.toUpperCase()
    ) {
      return failure(AppError.badRequest("Match columns must have the same scalar type"));
    }
    const primaryTime = left.find((c) => c.name === join.primaryTimeColumn);
    const secondaryTime = right.find((c) => c.name === join.secondaryTimeColumn);
    if (!primaryTime || !secondaryTime) {
      return failure(AppError.badRequest("Choose a timestamp or date column on each table"));
    }
    if (
      [primaryTime, secondaryTime].some(
        (c) => getColumnKind(c.type_text.toUpperCase()) !== "temporal",
      )
    ) {
      return failure(AppError.badRequest("Choose a timestamp or date column on each table"));
    }
    if ([left, right].some((columns) => !columns.some((c) => c.name === "id"))) {
      return failure(AppError.badRequest("Time matching requires row ids"));
    }
    const resolved = joinedColumns(left, right, join.tableName);
    const { metadata, variants, exceptColumns, reservedColumns } = secondary.value;
    return success({
      ...shape,
      columns: [...left, ...resolved],
      join: {
        ...join,
        primaryTimeType: primaryTime.type_text,
        secondaryTimeType: secondaryTime.type_text,
        primaryColumns: left.map((c) => c.name),
        secondaryColumns: resolved.map((c) => ({ name: c.sourceTable.columnName, alias: c.name })),
        secondary: {
          baseColumns: secondary.value.baseColumns,
          tableName: metadata.identifier,
          tableType: metadata.tableType,
          variants,
          exceptColumns,
          reservedColumns,
        },
      },
    });
  }

  private reads(shape: TableShape): ExperimentTableReads {
    return this.sourceReads(shape.source);
  }

  private sourceReads(source: ExperimentDataSource): ExperimentTableReads {
    return source === "store" ? this.storeReads : this.warehouseReads;
  }

  private async buildQuery(
    experimentId: string,
    shape: TableShape,
    options: Pick<
      ExperimentQueryParams,
      "columns" | "filters" | "aggregation" | "distinct" | "ordering" | "limit" | "offset"
    > = {},
  ): Promise<Result<TableQuery>> {
    const { filters, aggregation, distinct, ordering, limit, offset } = options;
    const { metadata, variants, exceptColumns, reservedColumns } = shape;
    const columns = this.withPhoneAnnotations(shape, options.columns);

    let effectiveOrdering = ordering;
    const questionType =
      ordering && !ordering.mode ? this.questionType(shape, ordering.column) : undefined;
    if (ordering && (questionType === "STRING" || questionType === "DOUBLE")) {
      effectiveOrdering = {
        ...ordering,
        mode: {
          kind: questionType === "STRING" ? "numericString" : "number",
          rowId: reservedColumns.includes(ROW_ID) ? ROW_ID : undefined,
        },
      };
    }

    let effectiveAggregation = aggregation;
    if (aggregation?.functions?.some((item) => takesWindow(item.function))) {
      const columnsResult = shape.columns
        ? success(shape.columns)
        : await this.getTableColumns({
            experimentId,
            tableName: metadata.identifier,
            source: shape.source,
          });
      if (columnsResult.isFailure()) return columnsResult;
      const tableColumns = columnsResult.value;
      effectiveAggregation = {
        ...aggregation,
        functions: aggregation.functions.map((item) => ({
          ...item,
          ...(item.function === "change_from_previous"
            ? {
                valueType: tableColumns.find(
                  (column) => column.name.toLowerCase() === item.column.toLowerCase(),
                )?.type_text,
              }
            : {}),
          ...(takesWindow(item.function)
            ? {
                tieBreaker: tableColumns.some((column) => column.name === ROW_ID)
                  ? ROW_ID
                  : undefined,
              }
            : {}),
        })),
      };
    }

    return this.reads(shape).buildQuery({
      join: shape.join,
      tableName: metadata.identifier,
      tableType: metadata.tableType,
      experimentId,
      columns,
      variants: variants.length > 0 ? variants : undefined,
      reservedColumns: reservedColumns.length > 0 ? reservedColumns : undefined,
      baseColumns: shape.baseColumns,
      exceptColumns: exceptColumns.length > 0 ? exceptColumns : undefined,
      filters,
      aggregation: effectiveAggregation,
      distinct,
      ordering: effectiveOrdering,
      limit,
      offset,
    });
  }

  private questionType(shape: TableShape, columnName: string): string | undefined {
    return this.flattenedFields(shape)
      .find(({ key, column }) => key === columnName && column === "questions_data")
      ?.field.type.toUpperCase();
  }

  private flattenedFields(shape: TableShape): FlattenedField<VariantColumn>[] {
    return FlattenedFields.resolve(
      shape.reservedColumns,
      shape.variants.map(({ columnName, schema, suffix }) => ({
        column: columnName,
        schema,
        suffix,
      })),
    );
  }

  /** Result columns a name clash renamed, keyed by the name they read as. */
  private renamedColumns(shape: TableShape): RenamedColumns {
    const renamed = this.flattenedFields(shape).filter(({ key, field }) => key !== field.name);
    return new Map(
      renamed.map(({ key, column, field }) => [key, { name: field.name, source: column }]),
    );
  }

  private executeQuery(shape: TableShape, query: TableQuery): Promise<Result<SchemaData>> {
    const key = `${shape.source}:${JSON.stringify(query)}`;
    const running = this.readsInFlight.get(key);
    if (running !== undefined) {
      return running;
    }

    const read = this.runQuery(shape, query).finally(() => this.readsInFlight.delete(key));
    this.readsInFlight.set(key, read);
    return read;
  }

  /**
   * Execute a generated SQL; on failure log the SQL too, since errors like
   * `UNRESOLVED_COLUMN` depend on the exact compiled query.
   */
  private async runQuery(shape: TableShape, query: TableQuery): Promise<Result<SchemaData>> {
    const dataResult = await this.reads(shape).runQuery(query);
    if (dataResult.isFailure()) {
      this.logger.error({
        msg: "Experiment data query failed",
        source: shape.source,
        sql: query.sql,
        error: dataResult.error.message,
      });
    }
    return dataResult;
  }

  /**
   * One page of every matching row, up to `ceiling`. The query asks for one row more than the
   * ceiling, so an extra row means the read stopped short, as does a result the warehouse cut at
   * its byte limit. Only then is the full count read.
   */
  private async getFullTableData(params: {
    tableName: string;
    experiment: ExperimentDto;
    shape: TableShape;
    query: TableQuery;
    countQuery: TableQuery;
    ceiling: number;
    read: ReadTrace;
  }): Promise<Result<TableDataDto[]>> {
    const { tableName, experiment, shape, query, countQuery, ceiling, read } = params;

    const [dataResult, dataMs] = await this.measure(() => this.executeQuery(shape, query));
    read.dataMs = dataMs;
    if (dataResult.isFailure()) {
      return dataResult;
    }

    const rows = dataResult.value.rows.slice(0, ceiling);
    const truncated = dataResult.value.rows.length > ceiling || dataResult.value.truncated;

    const totalResult = truncated
      ? await this.countRows(shape, countQuery, read)
      : success(rows.length);
    if (totalResult.isFailure()) {
      return totalResult;
    }

    const data: SchemaData = { ...dataResult.value, rows, totalRows: totalResult.value, truncated };
    const filled = await this.withPlatformAnnotations(read, shape, data);
    if (filled.isFailure()) {
      return filled;
    }

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: this.databricksPort.CENTRUM_SCHEMA_NAME,
        data: this.transformSchemaData(filled.value, experiment, shape),
        page: 1,
        pageSize: rows.length,
        totalRows: data.totalRows,
        totalPages: 1,
      },
    ]);
  }

  private async deviceValuesSql(
    experimentId: string,
    shape: TableShape,
    limit: number,
    offset = 0,
  ): Promise<Result<TableQuery>> {
    const projected = await this.buildQuery(experimentId, shape, {
      columns: ["device.serial_number"],
    });
    if (projected.isFailure()) {
      return projected;
    }
    return success({
      ...projected.value,
      sql: new SqlQueryBuilder()
        .select(["serial_number"])
        .distinct()
        .from(`(${projected.value.sql}) AS device_names`)
        .where("`serial_number` IS NOT NULL AND trim(`serial_number`) <> ''")
        .orderByRaw("lower(`serial_number`) ASC, `serial_number` ASC")
        .limit(limit + 1)
        .offset(offset)
        .build(),
      distinct: true,
    });
  }

  private async countRows(
    shape: TableShape,
    countQuery: TableQuery,
    read: ReadTrace,
  ): Promise<Result<number>> {
    const [countResult, countMs] = await this.measure(() => this.executeQuery(shape, countQuery));
    read.countMs = countMs;
    if (countResult.isFailure()) {
      return countResult;
    }
    return success(Number(countResult.value.rows[0]?.[0] ?? 0));
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

    const idsQuery = await this.buildQuery(experimentId, shape, { ...page, columns: [ROW_ID] });
    if (idsQuery.isFailure()) {
      return idsQuery;
    }

    const [idsResult, idsMs] = await this.measure(() => this.executeQuery(shape, idsQuery.value));
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
    const rowsQuery = await this.buildQuery(experimentId, shape, {
      columns: page.columns,
      filters: [{ column: ROW_ID, operator: "in", value: [...new Set(ids)] }],
    });
    if (rowsQuery.isFailure()) {
      return rowsQuery;
    }

    const [rowsResult, dataMs] = await this.measure(() =>
      this.executeQuery(shape, rowsQuery.value),
    );
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
    const queryResult = await this.buildQuery(experimentId, shape, page);
    if (queryResult.isFailure()) {
      return queryResult;
    }

    const [dataResult, dataMs] = await this.measure(() =>
      this.executeQuery(shape, queryResult.value),
    );
    read.dataMs = dataMs;
    return dataResult;
  }

  /** Only a large table with a payload gains from the second step, which matches rows by id. */
  private readsPayloadLate(shape: TableShape, columns?: string[]): boolean {
    const isLargeTable = shape.metadata.rowCount > LATE_PAYLOAD_MIN_ROWS;
    const hasPayload = shape.variants.length > 0;
    const carriesRowId = columns === undefined || columns.length === 0 || columns.includes(ROW_ID);
    const picksById = this.reads(shape).picksLargePagesById;
    return picksById && !shape.join && isLargeTable && hasPayload && carriesRowId;
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

  /** A page the warehouse cut at its byte limit would come back short, and paging on would skip rows. */
  private pageTooLarge(): Result<TableDataDto[]> {
    return failure(AppError.badRequest(PAGE_TOO_LARGE_MESSAGE, ErrorCodes.PAGE_TOO_LARGE));
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
      source: read.source,
      mode: read.mode,
      metadataMs: read.metadataMs,
      countMs: read.countMs,
      idsMs: read.idsMs,
      dataMs: read.dataMs,
      annotationsMs: read.annotationsMs,
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
    const hidden = this.separatePhoneAnnotations(shape);
    return columns.flatMap((column) => {
      if (column.name === hidden) {
        return [];
      }
      const joined = shape.columns?.find((c) => c.name === column.name);
      const renamedFrom = joined?.renamedFrom ?? renamed.get(column.name);
      return [
        {
          ...column,
          ...(joined?.sourceTable ? { sourceTable: joined.sourceTable } : {}),
          ...(renamedFrom ? { renamedFrom } : {}),
        },
      ];
    });
  }

  /** A read of the annotations also reads the phone's, when they sit in a column of their own. */
  private withPhoneAnnotations(shape: TableShape, columns?: string[]): string[] | undefined {
    const phone = this.separatePhoneAnnotations(shape);
    // A joined read takes the primary table's listed columns, which leave the phone's out.
    if (phone === undefined || columns === undefined || shape.join !== undefined) {
      return columns;
    }
    const missesPhoneColumn = columns.includes(ANNOTATIONS) && !columns.includes(phone);
    return missesPhoneColumn ? [...columns, phone] : columns;
  }

  /** The column the phone's annotations come from when it is not the annotations column itself. */
  private separatePhoneAnnotations(shape: TableShape): string | undefined {
    return shape.phoneAnnotationsFrom === ANNOTATIONS ? undefined : shape.phoneAnnotationsFrom;
  }

  /** Each row's annotations, the phone's then the platform's from Postgres, timed as a phase of the read. */
  private async withPlatformAnnotations(
    read: ReadTrace,
    shape: TableShape,
    data: SchemaData,
  ): Promise<Result<SchemaData>> {
    const [filled, annotationsMs] = await this.measure(() =>
      this.platformAnnotations.fill({
        experimentId: read.experimentId,
        tableName: read.tableName,
        data,
        phoneAnnotationsFrom: shape.phoneAnnotationsFrom,
      }),
    );
    read.annotationsMs = annotationsMs;
    this.logRead(read, data);
    return filled;
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
