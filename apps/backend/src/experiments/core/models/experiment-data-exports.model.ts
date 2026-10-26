import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import {
  zExperimentExportFormat,
  zExperimentExportPart,
} from "@repo/api/domains/experiment/exports/experiment-exports.schema";
import type { ExperimentExportRecord } from "@repo/api/domains/experiment/exports/experiment-exports.schema";
import type {
  experimentExportErrorCodeEnum,
  experimentExportFormatEnum,
  experimentExportStatusEnum,
} from "@repo/database";
import { experimentExports } from "@repo/database";

export type ExportFormat = (typeof experimentExportFormatEnum.enumValues)[number];
export type ExportStatus = (typeof experimentExportStatusEnum.enumValues)[number];
export type ExportErrorCode = (typeof experimentExportErrorCodeEnum.enumValues)[number];

/** An export in one of these states still has a job run to follow. */
export const IN_FLIGHT_EXPORT_STATUSES: ExportStatus[] = ["queued", "pending", "running"];

/** Matches the expiration rule on the export bucket, which deletes the files. */
export const EXPORT_RETENTION_DAYS = 30;

export const MANIFEST_FILE_NAME = "manifest.json";

export const experimentExportSchema = createSelectSchema(experimentExports, {
  parts: z.array(zExperimentExportPart).nullable(),
});

export type ExperimentExportDto = z.infer<typeof experimentExportSchema>;

/** What the export job writes beside the parts once they are all in place. */
export const exportManifestSchema = z.object({
  exportId: z.string().guid(),
  format: zExperimentExportFormat,
  rowCount: z.number().int().nonnegative(),
  snapshotAt: z.string().datetime({ offset: true }),
  parts: z.array(zExperimentExportPart),
});

export type ExportManifest = z.infer<typeof exportManifestSchema>;

/**
 * Key of an export file in the export bucket. The job writes through the `exports` volume,
 * whose storage location is the bucket's `exports/` prefix.
 */
export function exportObjectKey(record: ExperimentExportDto, fileName: string): string {
  const { experimentId, tableName, format, id } = record;
  return `exports/${experimentId}/${tableName}/${format}/${id}/${fileName}`;
}

export function toExportRecord(record: ExperimentExportDto): ExperimentExportRecord {
  return {
    exportId: record.id,
    experimentId: record.experimentId,
    tableName: record.tableName,
    format: record.format,
    status: record.status,
    rowCount: record.rowCount,
    totalBytes: record.totalBytes,
    partCount: record.parts?.length ?? null,
    errorCode: record.errorCode,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
  };
}
