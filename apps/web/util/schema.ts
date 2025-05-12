import z from "zod";
import { zExperimentStatus, zExperimentVisibility } from "@repo/api";

export const editExperimentSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string(),
  status: zExperimentStatus,
  visibility: zExperimentVisibility,
  embargoIntervalDays: z.number(),
});

export type Experiment = z.infer<typeof editExperimentSchema>;

export const createExperimentSchema = z.object({
  name: z.string().min(1).max(100),
  visibilityPrivate: z.boolean(),
});
