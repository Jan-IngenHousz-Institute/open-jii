import z from "zod";
import { zExperimentStatus, zExperimentVisibility } from "@repo/api";

export const experimentSchema = z.object({
  id: z.string(),
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }).max(255, {
    message: "Name must be maximum 255 characters.",
  }),
  description: z.string(),
  status: zExperimentStatus,
  visibility: zExperimentVisibility,
  embargoIntervalDays: z.number(),
});

export type Experiment = z.infer<typeof experimentSchema>;

export const createExperimentSchema = z.object({
  name: z.string().min(1).max(100),
  visibilityPrivate: z.boolean(),
});
