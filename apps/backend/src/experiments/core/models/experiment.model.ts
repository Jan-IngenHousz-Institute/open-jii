import { createInsertSchema } from "validator";

import { experiments } from "@repo/database";

export const createExperimentSchema = createInsertSchema(experiments).omit({
  id: true,
  createdAt: true,
  createdBy: true,
});
export const updateExperimentSchema = createInsertSchema(experiments)
  .partial()
  .omit({
    id: true,
    createdAt: true,
    createdBy: true,
  });

export type CreateExperimentDto = typeof createExperimentSchema._type;
export type UpdateExperimentDto = typeof updateExperimentSchema._type;
