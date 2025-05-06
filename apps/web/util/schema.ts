import z from "zod";

export const experimentSchema = z.object({
  id: z.string(),
  name: z.string(),
  private: z.boolean(),
  description: z.string().optional(),
});

export type Experiment = z.infer<typeof experimentSchema>;

export const createExperimentSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  private: z.boolean(),
});

export type CreateExperiment = z.infer<typeof createExperimentSchema>;
