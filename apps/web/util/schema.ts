import z from "zod";

import { zUpdateCommandRequestBody } from "@repo/api/schemas/command.schema";
import { zUpdateExperimentBody } from "@repo/api/schemas/experiment.schema";
import { zUpdateMacroRequestBody } from "@repo/api/schemas/macro.schema";

export const editExperimentFormSchema = zUpdateExperimentBody
  .required({
    name: true,
  })
  .extend({
    id: z.string().uuid(),
  });

export type EditExperimentForm = z.infer<typeof editExperimentFormSchema>;

export const editCommandFormSchema = zUpdateCommandRequestBody
  .required({
    name: true,
    family: true,
  })
  .extend({
    id: z.string().uuid(),
  });

export type EditCommandForm = z.infer<typeof editCommandFormSchema>;

export const editMacroFormSchema = zUpdateMacroRequestBody
  .required({
    name: true,
    language: true,
  })
  .extend({
    id: z.string().uuid(),
  });

export type EditMacroForm = z.infer<typeof editMacroFormSchema>;
