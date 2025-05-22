import z from "zod";

import { zUpdateExperimentBody } from "@repo/api";

export const editExperimentFormSchema = zUpdateExperimentBody
  .required({
    name: true,
  })
  .extend({
    id: z.string().uuid(),
  });

export type EditExperimentForm = z.infer<typeof editExperimentFormSchema>;

export const createExperimentFormSchema = z.object({
  name: z.string().min(1).max(100),
  visibilityPrivate: z.boolean(),
});
