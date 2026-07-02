import { z } from "zod";

export const zExperimentInitiateExportBody = z.object({
  tableName: z.string().describe("Name of the table to export"),
  format: z.enum(["csv", "ndjson", "json-array", "parquet"]).describe("Export format"),
  anonymizeContributors: z
    .boolean()
    .optional()
    .describe(
      "Per-export override of the experiment's anonymise-contributors setting. Falls back to the experiment's stored value when omitted.",
    ),
});

export const zExperimentInitiateExportResponse = z.object({
  status: z.string().describe("Export status"),
});

export const zExperimentListExportsQuery = z.object({
  tableName: z.string().describe("Name of the table"),
});

export const zExperimentExportRecord = z.object({
  exportId: z.string().uuid().nullable(),
  experimentId: z.string().uuid(),
  tableName: z.string(),
  format: z.enum(["csv", "ndjson", "json-array", "parquet"]),
  status: z.enum(["queued", "pending", "running", "completed", "failed"]),
  filePath: z.string().nullable(),
  rowCount: z.number().int().nullable(),
  fileSize: z.number().int().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export const zExperimentListExportsResponse = z.object({
  exports: z.array(zExperimentExportRecord),
});

export const zExperimentDownloadExportResponse = z.unknown(); // Response handled manually via streaming
export type ExperimentInitiateExportBody = z.infer<typeof zExperimentInitiateExportBody>;
export type ExperimentInitiateExportResponse = z.infer<typeof zExperimentInitiateExportResponse>;
export type ExperimentListExportsQuery = z.infer<typeof zExperimentListExportsQuery>;
export type ExperimentExportRecord = z.infer<typeof zExperimentExportRecord>;
export type ExperimentListExportsResponse = z.infer<typeof zExperimentListExportsResponse>;

export const zExperimentExportPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  exportId: z.string().uuid().describe("ID of the export"),
});
export type ExperimentExportPathParam = z.infer<typeof zExperimentExportPathParam>;
