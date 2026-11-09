import {
  ExperimentTableName,
  WellKnownColumnTypes,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

import type { ExperimentTableType } from "../../../../../experiments/core/models/experiment-data.model";

/** A column of an experiment table, typed as the warehouse's view types it. */
export interface StoreColumn {
  name: string;
  /** The warehouse's type, which pages render by and the store's cells are written in. */
  type: string;
  expression: string;
  /** A contributor or device the store holds as an id, whose details the backend fills in. */
  idOf?: "contributor" | "device";
}

export interface StoreTable {
  view: string;
  identifierColumn?: string;
  /** The table's ORDER BY columns after experiment_id, exactly as its migration writes them. */
  key: string[];
  columns: StoreColumn[];
}

const MACROS = "ARRAY<STRUCT<id: STRING, name: STRING, filename: STRING>>";

// Spark accepts zone ids the store does not know, such as PST or +02:00, and one of those fails the
// whole read; a zone the store does not know reads as no local time.
const KNOWN_ZONE = "timezone IN (SELECT time_zone FROM system.time_zones)";
const ZONE = `if(${KNOWN_ZONE}, timezone, 'UTC')`;

const MEASUREMENT_TIMES: StoreColumn[] = [
  { name: "timestamp", type: "TIMESTAMP", expression: "timestamp" },
  { name: "measurement_time_utc", type: "TIMESTAMP", expression: "timestamp" },
  { name: "timezone", type: "STRING", expression: "timezone" },
  { name: "date", type: "DATE", expression: "toDate(timestamp)" },
];

const LOCAL_TIMES: StoreColumn[] = [
  {
    name: "measurement_time_local",
    type: "STRING",
    expression: `if(${KNOWN_ZONE}, formatDateTime(timestamp, '%Y-%m-%d %H:%i:%S', ${ZONE}), NULL)`,
  },
  {
    name: "local_time",
    type: "STRING",
    expression: `if(${KNOWN_ZONE}, formatDateTime(timestamp, '%H:%i', ${ZONE}), NULL)`,
  },
];

const CONTRIBUTOR: StoreColumn = {
  name: "contributor",
  type: WellKnownColumnTypes.CONTRIBUTOR,
  expression: "user_id",
  idOf: "contributor",
};

const DEVICE: StoreColumn = {
  name: "device",
  type: WellKnownColumnTypes.DEVICE,
  expression: "client_id",
  idOf: "device",
};

// Annotations made on the platform and custom metadata are not in the store yet: a measurement's
// own annotations read, and custom metadata reads as none.
const CUSTOM_METADATA: StoreColumn = {
  name: "custom_metadata",
  type: "VARIANT",
  expression: "CAST(NULL AS Nullable(String))",
};

export const MEASUREMENTS_TABLE: StoreTable = {
  view: "experiment_measurements",
  key: ["timestamp", "id", "ifNull(device_id, '')"],
  columns: [
    { name: "experiment_id", type: "STRING", expression: "experiment_id" },
    { name: "id", type: "BIGINT", expression: "id" },
    { name: "device_id", type: "STRING", expression: "device_id" },
    { name: "device_name", type: "STRING", expression: "device_name" },
    ...MEASUREMENT_TIMES,
    { name: "macros", type: MACROS, expression: "macros" },
    { name: "questions_data", type: "VARIANT", expression: "questions_data" },
    CONTRIBUTOR,
    DEVICE,
    { name: "protocol_id", type: "STRING", expression: "protocol_id" },
    { name: "workbook_run_id", type: "STRING", expression: "workbook_run_id" },
    { name: "latitude", type: "DOUBLE", expression: "latitude" },
    { name: "longitude", type: "DOUBLE", expression: "longitude" },
    { name: "data", type: "VARIANT", expression: "data" },
    { name: "processed_timestamp", type: "TIMESTAMP", expression: "processed_timestamp" },
    ...LOCAL_TIMES,
    { name: "annotations", type: WellKnownColumnTypes.ANNOTATIONS, expression: "annotations" },
    CUSTOM_METADATA,
  ],
};

export const MACRO_RESULTS_TABLE: StoreTable = {
  view: "experiment_macro_results",
  identifierColumn: "macro_id",
  key: [
    "ifNull(macro_id, '')",
    "timestamp",
    "raw_id",
    "ifNull(macro_filename, '')",
    "ifNull(device_id, '')",
  ],
  columns: [
    { name: "experiment_id", type: "STRING", expression: "experiment_id" },
    { name: "id", type: "BIGINT", expression: "id" },
    { name: "raw_id", type: "BIGINT", expression: "raw_id" },
    { name: "device_id", type: "STRING", expression: "device_id" },
    { name: "device_name", type: "STRING", expression: "device_name" },
    ...MEASUREMENT_TIMES,
    CONTRIBUTOR,
    DEVICE,
    { name: "latitude", type: "DOUBLE", expression: "latitude" },
    { name: "longitude", type: "DOUBLE", expression: "longitude" },
    { name: "macro_id", type: "STRING", expression: "macro_id" },
    { name: "macro_name", type: "STRING", expression: "macro_name" },
    { name: "macro_filename", type: "STRING", expression: "macro_filename" },
    { name: "workbook_run_id", type: "STRING", expression: "workbook_run_id" },
    { name: "macro_output", type: "VARIANT", expression: "macro_output" },
    { name: "macro_error", type: "STRING", expression: "macro_error" },
    { name: "processed_timestamp", type: "TIMESTAMP", expression: "processed_timestamp" },
    { name: "questions_data", type: "VARIANT", expression: "questions_data" },
    ...LOCAL_TIMES,
    { name: "annotations", type: WellKnownColumnTypes.ANNOTATIONS, expression: "annotations" },
    CUSTOM_METADATA,
  ],
};

export const UPLOADS_TABLE: StoreTable = {
  view: "experiment_uploads",
  identifierColumn: "upload_table_id",
  key: ["ifNull(upload_table_id, '')", "uploaded_at", "id"],
  columns: [
    { name: "id", type: "BIGINT", expression: "id" },
    { name: "experiment_id", type: "STRING", expression: "experiment_id" },
    { name: "upload_table_id", type: "STRING", expression: "upload_table_id" },
    { name: "upload_table_name", type: "STRING", expression: "upload_table_name" },
    { name: "upload_id", type: "STRING", expression: "upload_id" },
    { name: "uploaded_at", type: "TIMESTAMP", expression: "uploaded_at" },
    { name: "uploaded_data", type: "VARIANT", expression: "uploaded_data" },
    { ...CONTRIBUTOR, expression: "created_by" },
    { name: "annotations", type: WellKnownColumnTypes.ANNOTATIONS, expression: "[]" },
    CUSTOM_METADATA,
  ],
};

export class StoreTables {
  /** The table a type reads. Of the static tables the store holds only raw data so far. */
  static of(tableType: ExperimentTableType, tableName: string): StoreTable | null {
    if (tableType === "macro") {
      return MACRO_RESULTS_TABLE;
    }
    if (tableType === "upload") {
      return UPLOADS_TABLE;
    }
    return tableName === ExperimentTableName.RAW_DATA ? MEASUREMENTS_TABLE : null;
  }

  /** Macro and upload tables are named by ids, which no static table's name can be. */
  static holds(tableName: string): boolean {
    const isStaticName = Object.values(ExperimentTableName).some((name) => name === tableName);
    return !isStaticName || StoreTables.of("static", tableName) !== null;
  }
}
