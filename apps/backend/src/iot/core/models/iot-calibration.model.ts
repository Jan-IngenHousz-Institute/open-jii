import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { zCaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import {
  zAppliedCalibrationBlocks,
  zCalibrationBlocks,
  zCalibrationFamily,
  zCalibrationOutputSchema,
  zCalibrationRunParams,
  zCalibrationRunPayload,
  zCalibrationWriteResults,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { calibrationDefinitions, calibrationRuns, deviceCalibrations } from "@repo/database";

export const createCalibrationDefinitionSchema = createInsertSchema(calibrationDefinitions)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
    organizationId: true,
    version: true,
  })
  .extend({
    family: zCalibrationFamily,
    captureProcedure: zCaptureProcedure,
    outputSchema: zCalibrationOutputSchema,
  });

// `family` narrows past the shared sensor enum: phones have no calibrations,
// and the create path cannot produce a "mobile" row.
export const selectCalibrationDefinitionSchema = createSelectSchema(calibrationDefinitions).extend({
  family: zCalibrationFamily,
  captureProcedure: zCaptureProcedure,
  outputSchema: zCalibrationOutputSchema,
});

export const selectCalibrationRunSchema = createSelectSchema(calibrationRuns).extend({
  payload: zCalibrationRunPayload.nullable(),
  params: zCalibrationRunParams.nullable(),
  blocks: zCalibrationBlocks.nullable(),
  preInfo: z.record(z.unknown()).nullable(),
  postInfo: z.record(z.unknown()).nullable(),
});

export const selectDeviceCalibrationSchema = createSelectSchema(deviceCalibrations).extend({
  blocks: zAppliedCalibrationBlocks,
  writeResults: zCalibrationWriteResults.nullable(),
});

export type CreateCalibrationDefinitionDto = z.infer<typeof createCalibrationDefinitionSchema>;
export type CalibrationDefinitionDto = z.infer<typeof selectCalibrationDefinitionSchema>;
export type CalibrationRunDto = z.infer<typeof selectCalibrationRunSchema>;
export type DeviceCalibrationDto = z.infer<typeof selectDeviceCalibrationSchema>;

/** Run row plus the version of the definition that produced it (join-derived). */
export type CalibrationRunWithVersionDto = CalibrationRunDto & { definitionVersion: number };

/**
 * The calibration sandbox handler's response contract. "computed" carries the
 * validated blocks; "compute_failed" is the script's fault (exception, missing
 * submit, schema or QC violation); "error" is a malformed event or handler
 * failure. Parsed, never trusted: the Lambda boundary is a system boundary.
 */
export const zCalibrationSandboxResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("computed"), blocks: zCalibrationBlocks }),
  z.object({
    status: z.literal("compute_failed"),
    error: z.string(),
    reasons: z.array(z.string()).optional(),
    traceback: z.array(z.string()).optional(),
  }),
  z.object({ status: z.literal("error"), error: z.string() }),
]);

export type CalibrationSandboxResponse = z.infer<typeof zCalibrationSandboxResponse>;
