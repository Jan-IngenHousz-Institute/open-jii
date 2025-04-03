import { createInsertSchema } from 'validator';
import { experiments } from 'database';

export const createExperimentSchema = createInsertSchema(experiments);
export const updateExperimentSchema = createInsertSchema(experiments).partial();

export type CreateExperimentDto = typeof createExperimentSchema._type;
export type UpdateExperimentDto = typeof updateExperimentSchema._type; 