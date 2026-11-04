import { z } from "zod";

export const zExperimentQuestionTypesRequest = z.object({
  experimentIds: z.array(z.string().uuid()).min(1).max(500),
});

export const zExperimentQuestionTypesResponse = z.object({
  success: z.literal(true),
  experiments: z.array(
    z.object({
      experimentId: z.string().uuid(),
      numericKeys: z.array(z.string()),
    }),
  ),
});
