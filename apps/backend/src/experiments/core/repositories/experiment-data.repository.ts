import { Injectable, Inject } from "@nestjs/common";

import { ExperimentTableName } from "@repo/api/schemas/experiment.schema";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { Result, success, failure, AppError } from "../../../common/utils/fp-utils";
import { STATIC_TABLE_CONFIG, MACRO_TABLE_CONFIG } from "../models/experiment-data.model";
import type {
  ExperimentTableMetadata,
  SchemaDataDto,
  TableConfig,
  TableDataDto,
} from "../models/experiment-data.model";
import { ExperimentDto } from "../models/experiment.model";
import { DELTA_PORT } from "../ports/delta.port";
import type { DeltaPort } from "../ports/delta.port";

type ColumnMeta = SchemaData["columns"][number];

/**
 * Repository for experiment data operations.
 *
 * Reads come from Delta Sharing — both the metadata cache table and the
 * per-experiment data tables are pulled as parquet files and decoded locally
 * via hyparquet. The SQL warehouse is no longer involved on the read path.
 *
 * Variants are flattened client-side: hyparquet decodes each VARIANT column to
 * a JS object, and we spread its keys to top-level columns to match the shape
 * the SQL warehouse used to produce via `from_json(...).*`.
 *
 * Filtering, sorting, and pagination are applied client-side; the protocol
 * gives us file-level pruning hints but mandates the client do the actual
 * row-level work.
 */
@Injectable()
export class ExperimentDataRepository {
  constructor(@Inject(DELTA_PORT) private readonly deltaPort: DeltaPort) {}

  async getTableData(params: {
    experimentId: string;
    experiment: ExperimentDto;
    tableName: string;
    columns?: string[];
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    page?: number;
    pageSize?: number;
  }): Promise<Result<TableDataDto[]>> {
    const {
      experimentId,
      experiment,
      tableName,
      columns,
      orderBy,
      orderDirection = "ASC",
      page = 1,
      pageSize = 5,
    } = params;

    const metadataResult = await this.deltaPort.getExperimentTableMetadata(experimentId, {
      identifier: tableName,
      includeSchemas: true,
    });
    if (metadataResult.isFailure()) return metadataResult;
    if (metadataResult.value.length === 0) {
      return failure(AppError.notFound(`Table '${tableName}' not found in experiment`));
    }

    const metadata = metadataResult.value[0];
    const targetResult = this.resolveTableTarget(experimentId, metadata);
    if (targetResult.isFailure()) return targetResult;
    const target = targetResult.value;

    const dataResult = await this.deltaPort.getTableData(target.physicalTable, {
      filters: target.filters,
    });
    if (dataResult.isFailure()) return dataResult;

    const flattened = this.flattenVariants(
      dataResult.value.rows as Record<string, unknown>[],
      dataResult.value.columns,
      target.config,
      metadata,
    );

    const processed = this.applyClientSideQuery(flattened.columns, flattened.rows, {
      // Dropping the requested columns set narrows AFTER variant flattening so
      // callers can ask for variant-derived field names directly.
      keepColumns: columns,
      exceptColumns: columns ? [] : target.config.exceptColumns,
      orderBy,
      orderDirection,
      page: columns ? undefined : page,
      pageSize: columns ? undefined : pageSize,
    });

    const totalRows = processed.totalRows;
    const totalPages = columns ? 1 : Math.max(1, Math.ceil(totalRows / pageSize));

    return success([
      {
        name: tableName,
        catalog_name: experiment.name,
        schema_name: this.deltaPort.CENTRUM_SCHEMA_NAME,
        data: this.transformSchemaData(processed.rows, processed.columns, totalRows),
        page: columns ? 1 : page,
        pageSize: columns ? totalRows : pageSize,
        totalRows,
        totalPages,
      },
    ]);
  }

  /**
   * Resolve logical identifier → (physical Delta-shared table, filters, config).
   * Macros all live in one shared table, scoped by experiment_id + macro_id.
   * Static tables are one table per identifier, scoped by experiment_id only.
   */
  private resolveTableTarget(
    experimentId: string,
    metadata: ExperimentTableMetadata,
  ): Result<{
    physicalTable: string;
    filters: Record<string, string>;
    config: TableConfig;
  }> {
    const { identifier, tableType } = metadata;

    if (tableType === "macro") {
      return success({
        physicalTable: this.deltaPort.MACRO_DATA_TABLE_NAME,
        filters: { experiment_id: experimentId, macro_id: identifier },
        config: MACRO_TABLE_CONFIG,
      });
    }

    const staticTable: Record<string, string | undefined> = {
      [ExperimentTableName.RAW_DATA]: this.deltaPort.RAW_DATA_TABLE_NAME,
      [ExperimentTableName.DEVICE]: this.deltaPort.DEVICE_DATA_TABLE_NAME,
      [ExperimentTableName.RAW_AMBYTE_DATA]: this.deltaPort.RAW_AMBYTE_DATA_TABLE_NAME,
    };
    const physicalTable = staticTable[identifier];
    const config = STATIC_TABLE_CONFIG[identifier];
    if (!physicalTable || !config) {
      return failure(
        AppError.internal(
          `No physical table mapping for static table '${identifier}'`,
          "UNKNOWN_TABLE_MAPPING",
        ),
      );
    }

    return success({
      physicalTable,
      filters: { experiment_id: experimentId },
      config,
    });
  }

  /**
   * Spread each VARIANT column's decoded object into top-level fields, matching
   * the shape the SQL `from_json(variant)::struct.*` flattening used to produce.
   *
   * For each variant column on the table, we use the schema string from
   * `experiment_table_metadata` to know which top-level keys to expect. If the
   * schema is null/empty we either drop the column entirely (matching the old
   * `exceptColumns.push(variant)` fallback) or fall back to scanning the
   * decoded rows for keys.
   */
  private flattenVariants(
    rows: Record<string, unknown>[],
    columns: ColumnMeta[],
    config: TableConfig,
    metadata: ExperimentTableMetadata,
  ): { rows: Record<string, unknown>[]; columns: ColumnMeta[] } {
    const schemaForVariant: Record<string, string | null | undefined> = {
      macro_output: metadata.macroSchema,
      questions_data: metadata.questionsSchema,
      custom_metadata: metadata.customMetadataSchema,
    };

    const newColumns: ColumnMeta[] = columns.filter(
      (c) => !config.variantColumns.includes(c.name as never),
    );
    const lastKnownPosition = () => newColumns.length;

    for (const variantCol of config.variantColumns) {
      const schema = schemaForVariant[variantCol];
      if (!schema) {
        // Pipeline produced no schema for this variant on this table → drop it
        // entirely. Matches the SQL builder's `exceptColumns.push(variantCol)`
        // fallback when the schema is missing.
        for (const row of rows) delete row[variantCol];
        continue;
      }

      const fields = parseVariantSchema(schema);
      if (fields.length === 0) {
        for (const row of rows) delete row[variantCol];
        continue;
      }

      // Spread each field to top-level on every row, then drop the original
      // variant column. Existing top-level keys are not overwritten — this
      // mirrors SQL behavior where flattened column names cannot collide with
      // the base SELECT (the query builder's "EXCEPT (variant, parsed_alias)").
      for (const row of rows) {
        const value = row[variantCol];
        const obj =
          value !== null && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
        for (const field of fields) {
          if (!(field.name in row)) {
            row[field.name] = obj ? (obj[field.name] ?? null) : null;
          }
        }
        delete row[variantCol];
      }

      // Append the new flattened columns to the output column list.
      for (const field of fields) {
        if (newColumns.some((c) => c.name === field.name)) continue;
        newColumns.push({
          name: field.name,
          type_name: field.type,
          type_text: field.type,
          position: lastKnownPosition(),
        });
      }
    }

    // Re-sequence positions to keep them dense (parquet column metadata used
    // sparse positions before flattening).
    return {
      rows,
      columns: newColumns.map((c, position) => ({ ...c, position })),
    };
  }

  /**
   * Apply post-fetch transformations: drop excluded columns, sort, slice for
   * pagination. Rows arrive as object-keyed records (already variant-flattened).
   */
  private applyClientSideQuery(
    columns: ColumnMeta[],
    rows: Record<string, unknown>[],
    opts: {
      keepColumns?: string[];
      exceptColumns: string[];
      orderBy?: string;
      orderDirection: "ASC" | "DESC";
      page?: number;
      pageSize?: number;
    },
  ): { columns: ColumnMeta[]; rows: Record<string, unknown>[]; totalRows: number } {
    const keep = opts.keepColumns ? new Set(opts.keepColumns) : null;
    const except = new Set(opts.exceptColumns);
    const filteredColumns = columns.filter((c) => {
      if (except.has(c.name)) return false;
      if (keep && !keep.has(c.name)) return false;
      return true;
    });

    const projectionNeeded = filteredColumns.length !== columns.length;
    let working = projectionNeeded
      ? rows.map((row) => {
          const next: Record<string, unknown> = {};
          for (const col of filteredColumns) next[col.name] = row[col.name];
          return next;
        })
      : rows;

    if (opts.orderBy) {
      const key = opts.orderBy;
      const dir = opts.orderDirection === "DESC" ? -1 : 1;
      working = [...working].sort((a, b) => compareValues(a[key], b[key]) * dir);
    }

    const totalRows = working.length;

    if (opts.page !== undefined && opts.pageSize !== undefined) {
      const start = (opts.page - 1) * opts.pageSize;
      working = working.slice(start, start + opts.pageSize);
    }

    return { columns: filteredColumns, rows: working, totalRows };
  }

  private transformSchemaData(
    rows: Record<string, unknown>[],
    columns: ColumnMeta[],
    totalRows: number,
  ): SchemaDataDto {
    return {
      columns,
      rows: rows.map((row) => {
        const dataRow: Record<string, string | null> = {};
        for (const col of columns) {
          const value = row[col.name];
          if (value == null) dataRow[col.name] = null;
          else if (typeof value === "string") dataRow[col.name] = value;
          else dataRow[col.name] = JSON.stringify(value);
        }
        return dataRow;
      }),
      totalRows,
      truncated: rows.length < totalRows,
    };
  }
}

/**
 * Parse the top-level fields of a Spark VARIANT schema string of the form
 *   `OBJECT<key1: TYPE1, key2: TYPE2, ...>`
 *
 * Nested OBJECT/ARRAY values are returned as raw type strings (we don't recurse
 * — only first-level keys become top-level columns). Top-level commas inside
 * angle brackets are respected.
 */
export function parseVariantSchema(schema: string): { name: string; type: string }[] {
  const trimmed = schema.trim();
  const match = /^OBJECT<([\s\S]*)>$/.exec(trimmed);
  if (!match) return [];
  const body = match[1];

  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "<") depth++;
    else if (c === ">") depth--;
    else if (c === "," && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));

  const fields: { name: string; type: string }[] = [];
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const name = part.slice(0, colon).trim();
    const type = part.slice(colon + 1).trim();
    if (name) fields.push({ name, type });
  }
  return fields;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const aStr = typeof a === "string" ? a : JSON.stringify(a);
  const bStr = typeof b === "string" ? b : JSON.stringify(b);
  return aStr.localeCompare(bStr);
}
