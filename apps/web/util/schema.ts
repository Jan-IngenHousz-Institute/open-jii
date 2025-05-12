import z from "zod";

export enum ExperimentStatus {
  "provisioning"= "provisioning",
  "provisioning_failed" = "provisioning_failed",
  "active" = "active",
  "stale" = "stale",
  "archived" = "archived",
  "published" = "published",
}

export enum ExperimentVisibility {
  "private" = "private",
  "public" = "public",
}

export const experimentSchema = z.object({
  id: z.string(),
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }).max(255, {
    message: "Name must be maximum 255 characters.",
  }),
  description: z.string(),
  status: z.nativeEnum(ExperimentStatus),
  visibility: z.nativeEnum(ExperimentVisibility),
  embargoIntervalDays: z.number(),
});

export type Experiment = z.infer<typeof experimentSchema>;

export const createExperimentSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }).max(255, {
    message: "Name must be maximum 255 characters.",
  }),
  visibilityPrivate: z.boolean(),
});

export type CreateExperiment = z.infer<typeof createExperimentSchema>;
