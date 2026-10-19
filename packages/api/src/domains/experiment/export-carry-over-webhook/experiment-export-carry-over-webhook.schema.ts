import { z } from "zod";

import {
  zExperimentExportFormat,
  zExperimentExportPart,
} from "../exports/experiment-exports.schema";

export const zExperimentExportCarryOverRecord = z.object({
  exportId: z.string().uuid(),
  experimentId: z.string().uuid(),
  tableName: z.string().min(1),
  format: zExperimentExportFormat,
  anonymizeContributors: z.boolean(),
  jobRunId: z.number().int().positive(),
  rowCount: z.number().int().positive(),
  parts: z.array(zExperimentExportPart).min(1),
  createdBy: z.string().uuid().describe("User who started the export"),
  createdAt: z.string().datetime().describe("When the export run started"),
  completedAt: z.string().datetime().describe("When the export run finished"),
});

export const zExperimentExportCarryOverPayload = z.object({
  exports: z.array(zExperimentExportCarryOverRecord).min(1).max(100),
});

export const zExperimentExportCarryOverResponse = z.object({
  imported: z.number().int().nonnegative().describe("Exports recorded by this call"),
});

export type ExperimentExportCarryOverRecord = z.infer<typeof zExperimentExportCarryOverRecord>;
export type ExperimentExportCarryOverPayload = z.infer<typeof zExperimentExportCarryOverPayload>;
export type ExperimentExportCarryOverResponse = z.infer<typeof zExperimentExportCarryOverResponse>;
