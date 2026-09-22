import { ExperimentTableName } from "@repo/api/domains/experiment/data/experiment-data.schema";

type VariantColumn = "macro_output" | "questions_data" | "custom_metadata" | "uploaded_data";

export type ExperimentTableType = "static" | "macro" | "upload";

/**
 * A dimension the enriched layer folded in, rebuilt at read time so the payload
 * is materialised once rather than copied into a second table. The relation is
 * unqualified; the adapter qualifies it with the catalog and schema it already
 * resolves for the served table.
 */
/**
 * The list and struct expressions the enrichment joins need. Each read engine
 * spells these differently, so the domain states what is required and the
 * query-builder module supplies the SQL. The join's shape and keys stay here
 * and are shared, because those diverging would be a correctness bug rather
 * than a syntax one.
 */
export interface EnrichmentSql {
  emptyArray: string;
  concatArrays(left: string, right: string): string;
  struct(fields: [string, string][]): string;
  sortedCollect(inner: string): string;
  castToString(expression: string): string;
}

export interface EnrichmentJoin {
  relation: string;
  alias: string;
  /**
   * Wraps the qualified relation so a dimension can aggregate before it joins.
   * `{relation}` is replaced with the qualified name.
   */
  derive?: string;
  on: {
    /** Column on the served relation, or an expression over it. */
    served: string;
    joined: string;
    /** The served side is SQL rather than an identifier. Config only. */
    servedIsExpression?: boolean;
  }[];
  select: { expression: string; alias: string }[];
}

export interface TableConfig {
  displayName: string;
  defaultSortColumn?: string;
  errorColumn?: string;
  exceptColumns: string[];
  variantColumns: VariantColumn[];
  enrichmentJoins: (sql: EnrichmentSql) => EnrichmentJoin[];
}

/** Resolves the pseudonymised contributor struct from the raw user id. */
const contributorJoin = (userColumn: string): EnrichmentJoin => ({
  relation: "experiment_contributors",
  alias: "enr_contributor",
  on: [
    { served: "experiment_id", joined: "experiment_id" },
    { served: userColumn, joined: "user_id" },
  ],
  select: [{ expression: "enr_contributor.user", alias: "contributor" }],
});

/** Resolves the registry device struct from the trusted client id. */
const DEVICE_JOIN: EnrichmentJoin = {
  relation: "experiment_devices",
  alias: "enr_device",
  on: [
    { served: "experiment_id", joined: "experiment_id" },
    { served: "client_id", joined: "client_id" },
  ],
  select: [{ expression: "enr_device.device", alias: "device" }],
};

/**
 * Annotations are written against a measurement after it lands, so they cannot
 * be folded in when the row is built. The struct and its ordering mirror
 * `add_annotation_column`; a reader compares these arrays to what the enriched
 * table produced, so field order is part of the contract.
 *
 * `hasUpstreamAnnotations` covers the tables whose payload already carries
 * annotations of its own, which are concatenated ahead of the stored ones.
 */
const annotationJoin =
  (hasUpstreamAnnotations: boolean) =>
  (sql: EnrichmentSql): EnrichmentJoin => {
    const annotation = sql.struct([
      ["id", "id"],
      ["rowId", "row_id"],
      ["type", "type"],
      [
        "content",
        sql.struct([
          ["text", "content_text"],
          ["flagType", "flag_type"],
        ]),
      ],
      ["createdBy", "user_id"],
      ["createdByName", "user_name"],
      ["createdAt", "created_at"],
      ["updatedAt", "updated_at"],
    ]);

    const stored = `coalesce(enr_annotation.db_annotations, ${sql.emptyArray})`;

    return {
      relation: "experiment_annotations_source",
      alias: "enr_annotation",
      derive:
        `(SELECT experiment_id, row_id, ${sql.sortedCollect(annotation)} AS db_annotations ` +
        `FROM {relation} GROUP BY experiment_id, row_id)`,
      on: [
        { served: "experiment_id", joined: "experiment_id" },
        // row_id is a string and id is a bigint. Casting the string side
        // instead would turn a non-numeric row_id into a null that silently
        // matches nothing, so the comparison stays on the string.
        {
          served: sql.castToString("base.id"),
          joined: "row_id",
          servedIsExpression: true,
        },
      ],
      select: [
        {
          expression: hasUpstreamAnnotations
            ? sql.concatArrays(`coalesce(base.annotations, ${sql.emptyArray})`, stored)
            : stored,
          alias: "annotations",
        },
      ],
    };
  };

/** Full configuration for known static tables (display + query). */
export const STATIC_TABLE_CONFIG: Partial<Record<string, TableConfig>> = {
  [ExperimentTableName.RAW_DATA]: {
    displayName: "Raw Data",
    defaultSortColumn: "timestamp",
    // client_id and user_id are the raw identifiers the contributor and device
    // structs exist to replace, so serving gold without excluding them would
    // expose what the enriched layer hid. The rest is internal plumbing.
    exceptColumns: [
      "experiment_id",
      "client_id",
      "user_id",
      "workbook_version_id",
      "macro_context",
      "output_data",
      "skip_macro_processing",
      "annotations",
    ],
    variantColumns: ["questions_data", "custom_metadata"],
    enrichmentJoins: (sql) => [contributorJoin("user_id"), DEVICE_JOIN, annotationJoin(true)(sql)],
  },
  [ExperimentTableName.DEVICE]: {
    displayName: "Device Metadata",
    defaultSortColumn: "processed_timestamp",
    exceptColumns: ["experiment_id"],
    variantColumns: [],
    enrichmentJoins: () => [],
  },
};

/** Full configuration for macro tables (display + query). */
export const MACRO_TABLE_CONFIG: TableConfig = {
  displayName: "Processed Data",
  defaultSortColumn: "timestamp",
  errorColumn: "macro_error",
  exceptColumns: [
    "experiment_id",
    "raw_id",
    "macro_id",
    "macro_name",
    "macro_filename",
    "date",
    "client_id",
    "user_id",
    "workbook_version_id",
    "annotations",
  ],
  variantColumns: ["macro_output", "questions_data", "custom_metadata"],
  enrichmentJoins: (sql) => [contributorJoin("user_id"), DEVICE_JOIN, annotationJoin(true)(sql)],
};

/** Full configuration for user-uploaded tables (display + query). */
export const UPLOAD_TABLE_CONFIG: TableConfig = {
  displayName: "Uploaded Data",
  defaultSortColumn: "uploaded_at",
  // created_by is the raw user id an uploader's pseudonym replaces.
  exceptColumns: [
    "experiment_id",
    "upload_table_id",
    "upload_table_name",
    "upload_id",
    "created_by",
  ],
  variantColumns: ["uploaded_data", "custom_metadata"],
  enrichmentJoins: (sql) => [contributorJoin("created_by"), annotationJoin(false)(sql)],
};

/**
 * Experiment table metadata returned from the Databricks metadata cache table.
 * Used across the adapter, port, and repository layers.
 */
export interface ExperimentTableMetadata {
  identifier: string;
  tableType: ExperimentTableType;
  displayName: string | null;
  rowCount: number;
  macroSchema?: string | null;
  questionsSchema?: string | null;
  customMetadataSchema?: string | null;
  uploadSchema?: string | null;
}

/**
 * Transformed schema data DTO returned to consumers.
 */
export interface SchemaDataDto {
  columns: {
    name: string;
    type_name: string;
    type_text: string;
  }[];
  rows: Record<string, string | null>[];
  totalRows: number;
  truncated: boolean;
}

/**
 * Table data DTO with pagination metadata.
 */
export interface TableDataDto {
  name: string;
  catalog_name: string;
  schema_name: string;
  data?: SchemaDataDto;
  page: number;
  pageSize: number;
  totalPages: number;
  totalRows: number;
}
