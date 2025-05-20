import z from "zod";

import { zExperimentVisibility } from "@repo/api";

export const editExperimentFormSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string(),
  visibility: zExperimentVisibility,
  embargoIntervalDays: z.number(),
});

export type EditExperimentForm = z.infer<typeof editExperimentFormSchema>;

export const createExperimentFormSchema = z.object({
  name: z.string().min(1).max(100),
  visibilityPrivate: z.boolean(),
});
