import z from "zod";

import { zUpdateExperimentBody, zUpdateProtocolRequestBody } from "@repo/api";

export const editExperimentFormSchema = zUpdateExperimentBody
  .required({
    name: true,
  })
  .extend({
    id: z.string().uuid(),
  });

export type EditExperimentForm = z.infer<typeof editExperimentFormSchema>;

export const editProtocolFormSchema = zUpdateProtocolRequestBody
  .required({
    name: true,
    family: true,
  })
  .extend({
    id: z.string().uuid(),
  });

export type EditProtocolForm = z.infer<typeof editProtocolFormSchema>;
