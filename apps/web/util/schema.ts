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
