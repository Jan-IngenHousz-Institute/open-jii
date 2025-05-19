import z from "zod";
import { zExperimentStatus, zExperimentVisibility } from "@repo/api";

export const newExperimentFormSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string(),
  status: zExperimentStatus,
  visibility: zExperimentVisibility,
  embargoIntervalDays: z.number(),
});

export const editExperimentFormSchema = newExperimentFormSchema.extend({
  id: z.string(),
});

export type ExperimentForm = z.infer<typeof editExperimentFormSchema>;

export const createExperimentFormSchema = z.object({
  name: z.string().min(1).max(100),
  visibilityPrivate: z.boolean(),
});
