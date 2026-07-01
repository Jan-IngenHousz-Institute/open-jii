import { z } from "zod";

import { zMacroLanguage } from "../../macro/macro.schema";
import { zSensorFamily } from "../../protocol/protocol.schema";
import { zExperimentQuestionKind } from "../experiment.schema";
import { zExperimentLocationInput } from "../locations/experiment-locations.schema";

export const zExperimentProjectTransferQuestionInput = z.object({
  kind: zExperimentQuestionKind,
  text: z.string().min(1).max(64),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional().default(false),
});

export const zExperimentProjectTransferWebhookPayload = z.object({
  experiment: z.object({
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    createdBy: z.string().uuid().describe("User ID of experiment creator/admin"),
    locations: z.array(zExperimentLocationInput).optional(),
  }),
  protocol: z
    .object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      code: z.record(z.unknown()).array(),
      family: zSensorFamily.default("multispeq"),
      createdBy: z.string().uuid().describe("User ID of protocol creator"),
    })
    .optional(),
  macro: z
    .object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
      language: zMacroLanguage.default("javascript"),
      code: z.string().min(1).describe("Base64 encoded macro code"),
      createdBy: z.string().uuid().describe("User ID of macro creator"),
    })
    .optional(),
  questions: z.array(zExperimentProjectTransferQuestionInput).optional(),
});

export const zExperimentProjectTransferWebhookResponse = z.object({
  success: z.boolean(),
  experimentId: z.string().uuid(),
  protocolId: z.string().uuid().nullable(),
  macroId: z.string().uuid().nullable(),
  macroFilename: z.string().nullable(),
  macroName: z.string().nullable(),
  flowId: z.string().uuid().nullable(),
  message: z.string().optional(),
});

export type ExperimentProjectTransferQuestionInput = z.infer<
  typeof zExperimentProjectTransferQuestionInput
>;
export type ExperimentProjectTransferWebhookPayload = z.infer<
  typeof zExperimentProjectTransferWebhookPayload
>;
export type ExperimentProjectTransferWebhookResponse = z.infer<
  typeof zExperimentProjectTransferWebhookResponse
>;
