import { ExperimentTableName } from "@repo/api/domains/experiment/data/experiment-data.schema";

type VariantColumn = "macro_output" | "questions_data" | "custom_metadata" | "uploaded_data";

export type ExperimentTableType = "static" | "macro" | "upload";

export interface TableConfig {
  displayName: string;
  defaultSortColumn?: string;
  errorColumn?: string;
  exceptColumns: string[];
  variantColumns: VariantColumn[];
}

/** Full configuration for known static tables (display + query). */
export const STATIC_TABLE_CONFIG: Partial<Record<string, TableConfig>> = {
  [ExperimentTableName.RAW_DATA]: {
    displayName: "Raw Data",
    defaultSortColumn: "timestamp",
    exceptColumns: ["experiment_id"],
    variantColumns: ["questions_data", "custom_metadata"],
  },
  [ExperimentTableName.DEVICE]: {
    displayName: "Device Metadata",
    defaultSortColumn: "processed_timestamp",
    exceptColumns: ["experiment_id"],
    variantColumns: [],
  },
};

/** Full configuration for macro tables (display + query). */
export const MACRO_TABLE_CONFIG: TableConfig = {
  displayName: "Processed Data",
  defaultSortColumn: "timestamp",
  errorColumn: "macro_error",
  exceptColumns: ["experiment_id", "raw_id", "macro_id", "macro_name", "macro_filename", "date"],
  variantColumns: ["macro_output", "questions_data", "custom_metadata"],
};

/** Full configuration for user-uploaded tables (display + query). */
export const UPLOAD_TABLE_CONFIG: TableConfig = {
  displayName: "Uploaded Data",
  defaultSortColumn: "uploaded_at",
  exceptColumns: ["experiment_id", "upload_table_name", "upload_id"],
  variantColumns: ["uploaded_data"],
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
