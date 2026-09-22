import type {
  AggregationSpec,
  FilterCondition,
} from "../../../common/modules/databricks/services/query-builder/query-builder.types";
import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import type { Result } from "../../../common/utils/fp-utils";
import type {
  EnrichmentJoin,
  EnrichmentSql,
  ExperimentTableMetadata,
} from "../models/experiment-data.model";

export const EXPERIMENT_DATA_READ_PORT = Symbol("EXPERIMENT_DATA_READ_PORT");

/**
 * Narrow read contract for experiment-data queries. Split from the fat
 * DatabricksPort so the read engine (SQL warehouse vs embedded DuckDB) can be
 * swapped per environment without touching the write/jobs surface.
 */
export interface ExperimentDataReadPort {
  readonly CENTRUM_SCHEMA_NAME: string;

  /**
   * Row counts and (optionally) variant schemas from the
   * experiment_table_metadata cache table.
   */
  getExperimentTableMetadata(
    experimentId: string,
    options?: {
      identifier?: string;
      includeSchemas?: boolean;
    },
  ): Promise<Result<ExperimentTableMetadata[]>>;

  /**
   * Build a SQL query for experiment data, dispatching by table type. Async
   * because engines that read via Delta Sharing resolve the FROM source to a
   * fresh pre-signed file list per query.
   */
  buildExperimentQuery(params: {
    tableName: string;
    tableType: "static" | "macro" | "upload";
    experimentId: string;
    columns?: string[];
    enrichmentJoins?: (sql: EnrichmentSql) => EnrichmentJoin[];
    /** Enrichment aliases to drop, having no schema to flatten. */
    omitEnrichment?: string[];
    variants?: { columnName: string; schema: string }[];
    exceptColumns?: string[];
    filters?: FilterCondition[];
    aggregation?: AggregationSpec;
    distinct?: boolean;
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  }): Promise<Result<string>>;

  executeSqlQuery(schemaName: string, sqlStatement: string): Promise<Result<SchemaData>>;
}
