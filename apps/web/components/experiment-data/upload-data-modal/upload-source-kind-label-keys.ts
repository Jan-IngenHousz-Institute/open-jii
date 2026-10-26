import type { ExperimentUploadSourceKind } from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";

// Ambyte is folder-based, so it sits last after the file-based tabular kinds.
export const UPLOAD_SOURCE_KINDS: ExperimentUploadSourceKind[] = [
  "csv",
  "tsv",
  "parquet",
  "json",
  "ndjson",
  "ambyte",
];

export const UPLOAD_SOURCE_KIND_LABEL_KEYS: Record<ExperimentUploadSourceKind, string> = {
  csv: "experimentData.uploadDataModal.sourceKind.csv",
  tsv: "experimentData.uploadDataModal.sourceKind.tsv",
  parquet: "experimentData.uploadDataModal.sourceKind.parquet",
  json: "experimentData.uploadDataModal.sourceKind.json",
  ndjson: "experimentData.uploadDataModal.sourceKind.ndjson",
  ambyte: "experimentData.uploadDataModal.sourceKind.ambyte",
};
