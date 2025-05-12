import z from "zod";

export const experimentSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(255),
  description: z.string(),
  status: z.string(),
  visibility: z.boolean(),
  embargoIntervalDays: z.number().default(90),
});

export type Experiment = z.infer<typeof experimentSchema>;

export const createExperimentSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  private: z.boolean(),
});

export type CreateExperiment = z.infer<typeof createExperimentSchema>;
