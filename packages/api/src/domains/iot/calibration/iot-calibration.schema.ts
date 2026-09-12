import { z } from "zod";

import { zSensorFamily } from "../../protocol/protocol.schema";
import { zVisibility } from "../../visibility/visibility.schema";
import { zIotDevicePathParam } from "../iot.schema";
import { zCaptureProcedure } from "./iot-calibration-procedure.schema";

// Phones self-register and have no calibration surface.
export const zCalibrationFamily = zSensorFamily.exclude(["mobile"]);

const COEFFICIENT_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const zCoefficientName = z.string().regex(COEFFICIENT_NAME_PATTERN);

const zNumberCoefficientSpec = z
  .object({
    type: z.literal("number"),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
  })
  .strict();

const zIntegerArrayCoefficientSpec = z
  .object({
    type: z.literal("integer_array"),
    length: z.number().int().min(1).max(64),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
  })
  .strict();

export const zCoefficientSpec = z.discriminatedUnion("type", [
  zNumberCoefficientSpec,
  zIntegerArrayCoefficientSpec,
]);

export const zCalibrationOutputSchema = z
  .object({
    blocks: z
      .record(zCoefficientName, z.record(zCoefficientName, zCoefficientSpec))
      .refine((blocks) => Object.keys(blocks).length > 0, {
        message: "At least one block is required",
      }),
  })
  .strict();

/** Families disagree on shape: Ambit "1.1.3", MiniPAR "1.03"; a missing patch compares as zero. */
export const zFirmwareVersion = z.string().regex(/^\d+(\.\d+){1,2}$/);

export const zCoefficientValue = z.union([z.number(), z.array(z.number().int())]);

/**
 * A bench run is routinely partial; each block records its own outcome so one
 * absent reference or declined step does not fail the session.
 */
export const zCalibrationBlockStatus = z.enum(["computed", "rejected", "skipped"]);

/**
 * A block's fit and quality records are free-form, and they land in a row that
 * is read on every run listing, so they are bounded like the info records are.
 */
const BLOCK_RECORD_MAX_BYTES = 16_384;
const zBlockRecord = z
  .record(z.unknown())
  .refine((record) => JSON.stringify(record).length <= BLOCK_RECORD_MAX_BYTES, {
    message: `A block record must serialise to at most ${BLOCK_RECORD_MAX_BYTES} bytes`,
  });

/** Coefficients are present exactly when a block computed; a rejected block keeps its QC record. */
export const zCalibrationBlock = z
  .object({
    status: zCalibrationBlockStatus,
    coefficients: z.record(zCoefficientName, zCoefficientValue).optional(),
    fit: zBlockRecord.optional(),
    quality: zBlockRecord.optional(),
    reason: z.string().max(2000).optional(),
  })
  .refine((block) => (block.status === "computed") === (block.coefficients !== undefined), {
    message: "Coefficients are present exactly when a block computed",
  });

export const zCalibrationBlocks = z.record(zCoefficientName, zCalibrationBlock);

/** Blocks that produced coefficients; the only ones approval ever applies. */
export const zAppliedCalibrationBlocks = z.record(
  zCoefficientName,
  z.object({
    coefficients: z.record(zCoefficientName, zCoefficientValue),
    fit: zBlockRecord.optional(),
    quality: zBlockRecord.optional(),
  }),
);

// "computed", not "fit_ok": some calibrations pass blocks through with no fitting.
// A run is computed when any block produced coefficients.
export const zCalibrationRunStatus = z.enum([
  "running",
  "computed",
  "compute_failed",
  "error",
  "approved",
  "rejected",
]);

export const zCalibrationInputSource = z.enum(["bench_wizard", "external_bench"]);

export const zCalibrationDefinition = z.object({
  id: z.string().uuid(),
  family: zCalibrationFamily,
  name: z.string(),
  description: z.string().nullable(),
  version: z.number().int().positive(),
  captureProcedure: zCaptureProcedure,
  script: z.string(),
  outputSchema: zCalibrationOutputSchema,
  // Older firmware is refused: unknown commands would produce numbers that look like data.
  minFirmwareVersion: zFirmwareVersion.nullable(),
  organizationId: z.string().uuid().nullable(),
  visibility: zVisibility,
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zCalibrationDefinitionSummary = zCalibrationDefinition.omit({
  captureProcedure: true,
  script: true,
  outputSchema: true,
  minFirmwareVersion: true,
});

export const zCalibrationDefinitionList = z.array(zCalibrationDefinitionSummary);

export const zCreateCalibrationDefinitionBody = z.object({
  family: zCalibrationFamily,
  name: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional(),
  captureProcedure: zCaptureProcedure,
  // 1 MB, matching the macro sandbox's handler-side script limit.
  script: z.string().min(1).max(1_000_000),
  outputSchema: zCalibrationOutputSchema,
  minFirmwareVersion: zFirmwareVersion.optional(),
  // Defaults to the creator's personal org; the caller must be a member.
  organizationId: z.string().uuid().optional(),
});

export const zCalibrationDefinitionPathParam = z.object({
  definitionId: z.string().uuid(),
});

export const zListCalibrationDefinitionsQuery = z.object({
  family: zCalibrationFamily.optional(),
});

// Cells hold what instruments and operators produced: numbers, text, arrays, or a compound setpoint.
const zSeriesCell = z.union([
  z.number(),
  z.string().max(4096),
  z.boolean(),
  z.array(z.number()).max(10_000),
  z.record(z.string(), z.union([z.number(), z.string().max(64)])),
]);
const zSeriesRow = z.record(z.string(), zSeriesCell.nullable());

export const zCalibrationRunPayload = z
  .record(z.string(), z.array(zSeriesRow).max(5000))
  .refine((series) => Object.keys(series).length <= 20, {
    message: "At most 20 series per run",
  });

/** Kept whole for the record; the cap stops a client posting megabytes into a row read on every listing. */
const INFO_RECORD_MAX_BYTES = 16_384;
const zInfoRecord = z
  .record(z.unknown())
  .refine((info) => JSON.stringify(info).length <= INFO_RECORD_MAX_BYTES, {
    message: `Device info must serialise to at most ${INFO_RECORD_MAX_BYTES} bytes`,
  });

export const zCalibrationRun = z.object({
  id: z.string().uuid(),
  definitionId: z.string().uuid(),
  definitionVersion: z.number().int().positive(),
  deviceId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  inputSource: zCalibrationInputSource,
  status: zCalibrationRunStatus,
  blocks: zCalibrationBlocks.nullable(),
  preInfo: zInfoRecord.nullable(),
  postInfo: zInfoRecord.nullable(),
  firmwareVersion: z.string().nullable(),
  errorMessage: z.string().nullable(),
  reviewedBy: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zCalibrationRunList = z.array(zCalibrationRun);

/** Run-level operator values (a lamp's certified output, a fixture id); the script sees them as params. */
export const zCalibrationRunParams = z.record(
  z.string(),
  z.union([z.number(), z.string().max(512), z.boolean()]),
);

export const zCreateCalibrationRunBody = zIotDevicePathParam.extend({
  definitionId: z.string().uuid(),
  payload: zCalibrationRunPayload,
  params: zCalibrationRunParams.optional(),
  preInfo: zInfoRecord.optional(),
  firmwareVersion: zFirmwareVersion.optional(),
});

// Blocks a bench tool computed itself: recorded without running the script; QC still applies at approval.
export const zCreateExternalCalibrationRunBody = zIotDevicePathParam.extend({
  definitionId: z.string().uuid(),
  blocks: zCalibrationBlocks,
  payload: zCalibrationRunPayload.optional(),
  params: zCalibrationRunParams.optional(),
  preInfo: zInfoRecord.optional(),
  postInfo: zInfoRecord.optional(),
  firmwareVersion: zFirmwareVersion.optional(),
});

export const zCalibrationRunPathParam = z.object({
  runId: z.string().uuid(),
});

/**
 * One verdict per block, not per run: a session can confirm one gain and fail
 * another. Nothing is rolled back, so a block that failed part way through may
 * have left earlier coefficients on the device; the error names the one that failed.
 */
export const zCalibrationWriteResult = z.object({
  verified: z.boolean(),
  error: z.string().max(2000).optional(),
});

export const zCalibrationWriteResults = z.record(zCoefficientName, zCalibrationWriteResult);

export const zDeviceCalibration = z.object({
  id: z.string().uuid(),
  deviceId: z.string().uuid(),
  runId: z.string().uuid(),
  // Only the blocks that computed; rejected and skipped ones stay on the run.
  blocks: zAppliedCalibrationBlocks,
  approvedBy: z.string().uuid(),
  validFrom: z.string().datetime(),
  supersededAt: z.string().datetime().nullable(),
  writtenToDeviceAt: z.string().datetime().nullable(),
  writeResults: zCalibrationWriteResults.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zDeviceCalibrationList = z.array(zDeviceCalibration);

export const zDeviceCalibrationPathParam = z.object({
  calibrationId: z.string().uuid(),
});

// Addresses the applied row rather than the device's active calibration, so a concurrent
// approval cannot get this write recorded on it.
export const zReportDeviceCalibrationWriteBody = zDeviceCalibrationPathParam.extend({
  writeResults: zCalibrationWriteResults,
  // Device state after the write; the counterpart of preInfo.
  postInfo: zInfoRecord.optional(),
});

export type CalibrationFamily = z.infer<typeof zCalibrationFamily>;
export type CoefficientSpec = z.infer<typeof zCoefficientSpec>;
export type CalibrationOutputSchema = z.infer<typeof zCalibrationOutputSchema>;
export type CalibrationBlockStatus = z.infer<typeof zCalibrationBlockStatus>;
export type CalibrationBlock = z.infer<typeof zCalibrationBlock>;
export type CalibrationBlocks = z.infer<typeof zCalibrationBlocks>;
export type AppliedCalibrationBlocks = z.infer<typeof zAppliedCalibrationBlocks>;
export type CalibrationRunParams = z.infer<typeof zCalibrationRunParams>;
export type CalibrationWriteResults = z.infer<typeof zCalibrationWriteResults>;
export type CalibrationRunStatus = z.infer<typeof zCalibrationRunStatus>;
export type CalibrationInputSource = z.infer<typeof zCalibrationInputSource>;
export type CalibrationDefinition = z.infer<typeof zCalibrationDefinition>;
export type CalibrationDefinitionSummary = z.infer<typeof zCalibrationDefinitionSummary>;
export type CreateCalibrationDefinitionBody = z.infer<typeof zCreateCalibrationDefinitionBody>;
export type CalibrationRunPayload = z.infer<typeof zCalibrationRunPayload>;
export type CalibrationRun = z.infer<typeof zCalibrationRun>;
export type CreateCalibrationRunBody = z.infer<typeof zCreateCalibrationRunBody>;
export type CreateExternalCalibrationRunBody = z.infer<typeof zCreateExternalCalibrationRunBody>;
export type ReportDeviceCalibrationWriteBody = z.infer<typeof zReportDeviceCalibrationWriteBody>;
export type DeviceCalibration = z.infer<typeof zDeviceCalibration>;
