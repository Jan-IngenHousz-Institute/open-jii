import { z } from "zod";

export const zExperimentExportFormat = z.enum(["csv", "ndjson", "json-array", "parquet", "xlsx"]);

export const zExperimentExportStatus = z.enum([
  "queued",
  "pending",
  "running",
  "completed",
  "failed",
  "expired",
]);

export const zExperimentExportErrorCode = z.enum([
  "no_data",
  "too_many_rows_for_format",
  "unknown",
]);

// An export's table name and its file names become storage paths, so both are plain identifiers.
export const zExperimentExportTableName = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Table names are letters, digits, underscores and hyphens");

export const zExperimentExportPart = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(
      /^(?!\.\.?$)[A-Za-z0-9._-]+$/,
      "File names are letters, digits, dots, underscores and hyphens",
    ),
  sizeBytes: z.number().int().nonnegative(),
});

export const zExperimentInitiateExportBody = z.object({
  tableName: zExperimentExportTableName.describe("Name of the table to export"),
  format: zExperimentExportFormat.describe("Export format"),
  anonymizeContributors: z
    .boolean()
    .optional()
    .describe(
      "Per-export override of the experiment's anonymise-contributors setting. Falls back to the experiment's stored value when omitted.",
    ),
});

export const zExperimentListExportsQuery = z.object({
  tableName: zExperimentExportTableName.describe("Name of the table"),
});

export const zExperimentExportRecord = z.object({
  exportId: z.string().guid(),
  experimentId: z.string().guid(),
  tableName: z.string(),
  format: zExperimentExportFormat,
  status: zExperimentExportStatus,
  rowCount: z.number().int().nullable(),
  totalBytes: z.number().int().nullable(),
  partCount: z.number().int().nullable(),
  errorCode: zExperimentExportErrorCode.nullable(),
  createdBy: z.string().guid(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
});

export const zExperimentInitiateExportResponse = zExperimentExportRecord;

export const zExperimentListExportsResponse = z.object({
  exports: z.array(zExperimentExportRecord),
});

export const zExperimentExportIdPathParam = z.object({
  exportId: z.string().guid().describe("ID of the export"),
});

export const zExperimentExportDownloadLink = z.object({
  index: z.number().int().nonnegative(),
  fileName: z.string().describe("Name the browser saves the part under"),
  sizeBytes: z.number().int().nonnegative(),
  url: z.string().url().describe("Short-lived signed link that downloads the part from storage"),
});

export const zExperimentExportDownloadLinksResponse = z.object({
  parts: z.array(zExperimentExportDownloadLink),
  expiresAt: z.string().datetime().describe("When the links stop working"),
});

export type ExperimentExportFormat = z.infer<typeof zExperimentExportFormat>;
export type ExperimentExportStatus = z.infer<typeof zExperimentExportStatus>;
export type ExperimentExportErrorCode = z.infer<typeof zExperimentExportErrorCode>;
export type ExperimentExportPart = z.infer<typeof zExperimentExportPart>;
export type ExperimentInitiateExportBody = z.infer<typeof zExperimentInitiateExportBody>;
export type ExperimentInitiateExportResponse = z.infer<typeof zExperimentInitiateExportResponse>;
export type ExperimentListExportsQuery = z.infer<typeof zExperimentListExportsQuery>;
export type ExperimentExportRecord = z.infer<typeof zExperimentExportRecord>;
export type ExperimentListExportsResponse = z.infer<typeof zExperimentListExportsResponse>;
export type ExperimentExportDownloadLink = z.infer<typeof zExperimentExportDownloadLink>;
export type ExperimentExportDownloadLinksResponse = z.infer<
  typeof zExperimentExportDownloadLinksResponse
>;
