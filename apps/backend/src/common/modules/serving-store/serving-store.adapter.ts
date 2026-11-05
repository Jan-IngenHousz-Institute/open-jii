import { Injectable, Logger } from "@nestjs/common";
import { createHash } from "crypto";

import type {
  ExperimentTableMetadata,
  ExperimentTableType,
} from "../../../experiments/core/models/experiment-data.model";
import type {
  ServingStorePort,
  StoreQuery,
  StoreQueryColumn,
  StoreQueryParams,
} from "../../../experiments/core/ports/serving-store.port";
import { AppError, failure, success } from "../../utils/fp-utils";
import type { Result } from "../../utils/fp-utils";
import { QueryBuilderInputError } from "../databricks/services/query-builder/query-builder.types";
import { VariantSchema } from "../databricks/services/query-builder/schema/variant-schema";
import type { SchemaData } from "../databricks/services/sql/sql.types";
import { WarehouseCells } from "./services/cells/warehouse-cells";
import { ServingStoreClientService } from "./services/client/client.service";
import { StoreQueryBuilder } from "./services/query-builder/store-query-builder";
import { StoreTables } from "./services/query-builder/store-tables";

const TABLE_TYPES: Record<string, ExperimentTableType> = {
  static: "static",
  macro: "macro",
  upload: "upload",
};

@Injectable()
export class ServingStoreAdapter implements ServingStorePort {
  private readonly logger = new Logger(ServingStoreAdapter.name);

  constructor(private readonly client: ServingStoreClientService) {}

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  holdsTable(tableName: string): boolean {
    return StoreTables.holds(tableName);
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
          latestRowAt: WarehouseCells.text(latestRowAt, "TIMESTAMP"),
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
      .serialNumbers(params.deviceSerials ?? []);

    if (params.distinct) {
      builder.distinct();
    }
    for (const { columnName, schema, suffix } of params.variants ?? []) {
      builder.parseVariant(columnName, schema, suffix);
    }
    if (params.exceptColumns && params.exceptColumns.length > 0) {
      builder.except(params.exceptColumns);
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
      return success({ sql: builder.build(), columns: builder.outputColumns() });
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

  /** The rows as the warehouse writes its cells, with contributors and devices as their ids. */
  async executeQuery(query: StoreQuery): Promise<Result<SchemaData>> {
    const result = await this.client.query(query.sql);
    if (result.isFailure()) {
      return result;
    }

    const columns = query.columns.map(({ name, type }, position) => ({
      name,
      type_name: this.typeName(type),
      type_text: type,
      position,
    }));
    const rows = result.value.rows.map((row) =>
      query.columns.map(({ type, idOf }, index) => {
        const value = row[index];
        if (idOf !== undefined) {
          return typeof value === "string" ? value : null;
        }
        return WarehouseCells.text(value, type);
      }),
    );
    return success({ columns, rows, totalRows: rows.length, truncated: false });
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
    return type === "BIGINT" ? "LONG" : type;
  }
}
