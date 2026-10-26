import type { ExperimentExportFormat } from "@repo/api/domains/experiment/exports/experiment-exports.schema";

export const EXPORT_FORMATS: ExperimentExportFormat[] = [
  "csv",
  "ndjson",
  "json-array",
  "parquet",
  "xlsx",
];

export const EXPORT_FORMAT_LABEL_KEYS: Record<ExperimentExportFormat, string> = {
  csv: "experimentData.exportModal.formats.csv",
  ndjson: "experimentData.exportModal.formats.ndjson",
  "json-array": "experimentData.exportModal.formats.json-array",
  parquet: "experimentData.exportModal.formats.parquet",
  xlsx: "experimentData.exportModal.formats.xlsx",
};
