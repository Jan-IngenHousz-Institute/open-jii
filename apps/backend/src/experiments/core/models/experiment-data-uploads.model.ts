import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import {
  zExperimentUploadErrorCode,
  zExperimentUploadRejectedFile,
} from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";
import type { ExperimentUploadRecord } from "@repo/api/domains/experiment/uploads/experiment-uploads.schema";
import type { experimentUploadErrorCodeEnum, experimentUploadStatusEnum } from "@repo/database";
import { experimentUploads } from "@repo/database";

export type UploadStatus = (typeof experimentUploadStatusEnum.enumValues)[number];
export type UploadErrorCode = (typeof experimentUploadErrorCodeEnum.enumValues)[number];

/** An upload in one of these states still has files arriving or a job run to follow. */
export const IN_FLIGHT_UPLOAD_STATUSES: UploadStatus[] = [
  "receiving",
  "queued",
  "pending",
  "running",
];

export const experimentUploadSchema = createSelectSchema(experimentUploads, {
  rejectedFiles: z.array(zExperimentUploadRejectedFile).nullable(),
});

export type ExperimentUploadDto = z.infer<typeof experimentUploadSchema>;

/**
 * The upload job's exit value. A run that ends SUCCESS reports a failed upload here, so a
 * researcher's bad file neither retries the job nor alerts the team.
 */
export const uploadOutcomeSchema = z.object({
  uploadId: z.string().uuid(),
  outcome: z.enum(["completed", "failed"]),
  rowCount: z.number().int().nonnegative(),
  rejectedFiles: z.array(zExperimentUploadRejectedFile),
  errorCode: zExperimentUploadErrorCode.exclude(["transfer_interrupted"]).nullable(),
});

export type UploadOutcome = z.infer<typeof uploadOutcomeSchema>;

export function toUploadRecord(record: ExperimentUploadDto): ExperimentUploadRecord {
  return {
    uploadId: record.id,
    experimentId: record.experimentId,
    uploadTableId: record.uploadTableId,
    uploadTableName: record.uploadTableName,
    sourceKind: record.sourceKind,
    status: record.status,
    fileCount: record.fileCount,
    rowCount: record.rowCount,
    rejectedFiles: record.rejectedFiles ?? [],
    errorCode: record.errorCode,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  };
}
