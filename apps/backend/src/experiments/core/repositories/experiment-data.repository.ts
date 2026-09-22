import { Injectable, Inject, Logger } from "@nestjs/common";

import { isDecimalType, isNumericType } from "@repo/api/transforms/column-type-utils";

import type {
  AggregationSpec,
  FilterCondition,
} from "../../../common/modules/databricks/services/query-builder/query-builder.types";
import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { Result, success, failure, AppError } from "../../../common/utils/fp-utils";
import { ContributorAnonymizerService } from "../../application/services/contributor-anonymizer.service";
import {
  MACRO_TABLE_CONFIG,
  STATIC_TABLE_CONFIG,
  UPLOAD_TABLE_CONFIG,
} from "../models/experiment-data.model";
import type {
  ExperimentTableMetadata,
  SchemaDataDto,
  TableDataDto,
} from "../models/experiment-data.model";
import { ExperimentDto } from "../models/experiment.model";
import { CACHE_PORT } from "../ports/cache.port";
import type { CachePort } from "../ports/cache.port";
import { EXPERIMENT_DATA_READ_PORT } from "../ports/experiment-data-read.port";
import type { ExperimentDataReadPort } from "../ports/experiment-data-read.port";

type ReadMode = "aggregation" | "filtered-page" | "filtered-all" | "page";

interface ReadTrace {
  experimentId: string;
  tableName: string;
  mode: ReadMode;
  startedAt: number;
  metadataMs: number;
  countMs?: number;
}

@Injectable()
export class ExperimentDataRepository {
  private readonly logger = new Logger(ExperimentDataRepository.name);

  constructor(
    @Inject(EXPERIMENT_DATA_READ_PORT) private readonly readPort: ExperimentDataReadPort,
    @Inject(CACHE_PORT) private readonly cachePort: CachePort,
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

    const [metadataResult, metadataMs] = await this.measure(() =>
      this.tableMetadata(experimentId, tableName),
    );
    read.metadataMs = metadataMs;

    if (metadataResult.isFailure()) {
      return metadataResult;
    }
    if (metadataResult.value.length === 0) {
      return failure(AppError.notFound(`Table '${tableName}' not found in experiment`));
    }

    const metadata = metadataResult.value[0];
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
      const queryResult = await this.buildQuery(experimentId, metadata, {
        filters: effectiveFilters,
        aggregation,
        orderBy,
        orderDirection,
        limit,
      });
      if (queryResult.isFailure()) {
        return queryResult;
      }
      return this.getFullTableData({ tableName, experiment, query: queryResult.value, read });
    }

    // Filters or column projection requested.
    if (hasFilters || hasColumns) {
      if (hasPaging) {
        read.mode = "filtered-page";
        const offset = (page - 1) * pageSize;

        // COUNT(*) over the unpaged filter query.
        const countSubqueryResult = await this.buildQuery(experimentId, metadata, {
          columns,
          filters: effectiveFilters,
        });
        if (countSubqueryResult.isFailure()) {
          return countSubqueryResult;
        }
        const countSql = `SELECT COUNT(*) AS total FROM (${countSubqueryResult.value}) AS sub`;

        const dataQueryResult = await this.buildQuery(experimentId, metadata, {
          columns,
          filters: effectiveFilters,
          orderBy,
          orderDirection,
          limit: pageSize,
          offset,
        });
        if (dataQueryResult.isFailure()) {
          return dataQueryResult;
        }

        const [[countResult, countMs], [dataResult, dataMs]] = await Promise.all([
          this.measure(() => this.executeQuery(countSql)),
          this.measure(() => this.executeQuery(dataQueryResult.value)),
        ]);
        read.countMs = countMs;
        if (countResult.isFailure()) {
          return countResult;
        }
        if (dataResult.isFailure()) {
          return dataResult;
        }
        this.logRead(read, dataMs, dataResult.value);

        const totalRows = Number(countResult.value.rows[0]?.[0] ?? 0);
        return success([
          this.tablePage({
            tableName,
            experiment,
            page,
            pageSize,
            rowCount: totalRows,
            data: dataResult.value,
          }),
        ]);
      }

      // Chart-style: all matching rows in one page, capped by `limit`.
      read.mode = "filtered-all";
      const queryResult = await this.buildQuery(experimentId, metadata, {
        columns,
        filters: effectiveFilters,
        orderBy,
        orderDirection,
        limit,
      });
      if (queryResult.isFailure()) {
        return queryResult;
      }
      return this.getFullTableData({ tableName, experiment, query: queryResult.value, read });
    }

    // Plain paginated read (no filters, no aggregation, no projection).
    const usedPage = page ?? 1;
    const usedPageSize = pageSize ?? 5;
    const offset = (usedPage - 1) * usedPageSize;
    const queryResult = await this.buildQuery(experimentId, metadata, {
      orderBy,
      orderDirection,
      limit: usedPageSize,
      offset,
    });
    if (queryResult.isFailure()) {
      return queryResult;
    }

    return this.getTableDataPage({
      tableName,
      experiment,
      page: usedPage,
      pageSize: usedPageSize,
      rowCount: metadata.rowCount,
      query: queryResult.value,
      read,
    });
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

    const metadataResult = await this.tableMetadata(experimentId, tableName);
    if (metadataResult.isFailure()) {
      return metadataResult;
    }
    if (metadataResult.value.length === 0) {
      return failure(AppError.notFound(`Table '${tableName}' not found in experiment`));
    }

    const queryResult = await this.buildQuery(experimentId, metadataResult.value[0], {
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
   * Schemas and row count for one table, held for a minute: every read needs
   * them to build its SQL, and they only move when the pipeline runs. A failed
   * lookup is thrown through the cache so it is never stored, and callers
   * sharing the in-flight load all see the failure.
   */
  private tableMetadataCacheKey(experimentId: string, tableName: string): string {
    return `table-metadata:${experimentId}:${tableName}`;
  }

  private async tableMetadata(
    experimentId: string,
    tableName: string,
  ): Promise<Result<ExperimentTableMetadata[]>> {
    try {
      const rows = await this.cachePort.tryCache(
        this.tableMetadataCacheKey(experimentId, tableName),
        async () => {
          const result = await this.readPort.getExperimentTableMetadata(experimentId, {
            identifier: tableName,
            includeSchemas: true,
          });
          if (result.isFailure()) {
            throw result.error;
          }
          return result.value;
        },
      );
      return success(rows ?? []);
    } catch (error) {
      if (error instanceof AppError) {
        return failure(error);
      }
      throw error;
    }
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

  private async buildQuery(
    experimentId: string,
    metadata: ExperimentTableMetadata,
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
  ): Promise<Result<string>> {
    const { columns, filters, aggregation, distinct, orderBy, orderDirection, limit, offset } =
      options;
    const {
      identifier: tableName,
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
      return STATIC_TABLE_CONFIG[tableName];
    })();

    if (!config) {
      return failure(
        AppError.internal(
          `No table configuration found for static table '${tableName}'`,
          "UNKNOWN_TABLE_CONFIG",
        ),
      );
    }

    const exceptColumns = [...config.exceptColumns];
    const variants: { columnName: string; schema: string }[] = [];

    if (config.variantColumns.includes("macro_output")) {
      if (macroSchema) {
        variants.push({ columnName: "macro_output", schema: macroSchema });
      } else {
        exceptColumns.push("macro_output");
      }
    }

    if (config.variantColumns.includes("questions_data")) {
      if (questionsSchema) {
        variants.push({ columnName: "questions_data", schema: questionsSchema });
      } else {
        exceptColumns.push("questions_data");
      }
    }

    if (config.variantColumns.includes("custom_metadata")) {
      if (customMetadataSchema) {
        variants.push({ columnName: "custom_metadata", schema: customMetadataSchema });
      } else {
        exceptColumns.push("custom_metadata");
      }
    }

    if (config.variantColumns.includes("uploaded_data")) {
      if (uploadSchema) {
        variants.push({ columnName: "uploaded_data", schema: uploadSchema });
      } else {
        exceptColumns.push("uploaded_data");
      }
    }

    return this.readPort.buildExperimentQuery({
      tableName,
      tableType,
      experimentId,
      columns,
      enrichmentJoins: config.enrichmentJoins,
      variants: variants.length > 0 ? variants : undefined,
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

  /**
   * Execute a generated SQL; on failure log the SQL too, since errors like
   * `UNRESOLVED_COLUMN` depend on the exact compiled query.
   */
  private async executeQuery(query: string): Promise<Result<SchemaData>> {
    const dataResult = await this.readPort.executeSqlQuery(
      this.readPort.CENTRUM_SCHEMA_NAME,
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
    query: string;
    read: ReadTrace;
  }): Promise<Result<TableDataDto[]>> {
    const { tableName, experiment, query, read } = params;

    const [dataResult, dataMs] = await this.measure(() => this.executeQuery(query));
    if (dataResult.isFailure()) {
      return dataResult;
    }
    this.logRead(read, dataMs, dataResult.value);

    const totalRows = dataResult.value.totalRows;

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: this.readPort.CENTRUM_SCHEMA_NAME,
        data: this.transformSchemaData(dataResult.value, experiment),
        page: 1,
        pageSize: totalRows,
        totalRows,
        totalPages: 1,
      },
    ]);
  }

  private async getTableDataPage(params: {
    tableName: string;
    experiment: ExperimentDto;
    page: number;
    pageSize: number;
    rowCount: number;
    query: string;
    read: ReadTrace;
  }): Promise<Result<TableDataDto[]>> {
    const { tableName, experiment, page, pageSize, rowCount, query, read } = params;

    const [dataResult, dataMs] = await this.measure(() => this.executeQuery(query));
    if (dataResult.isFailure()) {
      return dataResult;
    }
    this.logRead(read, dataMs, dataResult.value);

    return success([
      this.tablePage({ tableName, experiment, page, pageSize, rowCount, data: dataResult.value }),
    ]);
  }

  private tablePage(params: {
    tableName: string;
    experiment: ExperimentDto;
    page: number;
    pageSize: number;
    rowCount: number;
    data: SchemaData;
  }): TableDataDto {
    const { tableName, experiment, page, pageSize, rowCount, data } = params;
    return {
      name: tableName,
      catalog_name: experiment.name,
      schema_name: this.readPort.CENTRUM_SCHEMA_NAME,
      data: this.transformSchemaData(data, experiment),
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
  private logRead(read: ReadTrace, dataMs: number, data: SchemaData): void {
    this.logger.log({
      msg: "Experiment data read",
      operation: "getTableData",
      experimentId: read.experimentId,
      tableName: read.tableName,
      mode: read.mode,
      metadataMs: read.metadataMs,
      countMs: read.countMs,
      dataMs,
      totalMs: Math.round(performance.now() - read.startedAt),
      rows: data.rows.length,
      totalRows: data.totalRows,
      truncated: data.truncated,
    });
  }

  /**
   * Convert schema data to DTO and route every row through the
   * contributor anonymiser; the single seat for that policy.
   */
  private transformSchemaData(schemaData: SchemaData, experiment: ExperimentDto): SchemaDataDto {
    const rows = schemaData.rows.map((row) => {
      const dataRow: Record<string, string | null> = {};
      row.forEach((value, index) => {
        dataRow[schemaData.columns[index].name] = value;
      });
      return dataRow;
    });
    return {
      columns: schemaData.columns,
      rows: this.contributorAnonymizer.anonymizeRows(rows, schemaData.columns, experiment),
      totalRows: schemaData.totalRows,
      truncated: schemaData.truncated,
    };
  }
}
