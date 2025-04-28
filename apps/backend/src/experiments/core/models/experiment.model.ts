import { createInsertSchema, createSelectSchema } from "validator";
import { z } from "validator";

import {
  experiments,
  experimentStatusEnum,
  experimentVisibilityEnum,
} from "@repo/database";

// Create schemas for database operations
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
export const selectExperimentSchema = createSelectSchema(experiments);

// Define the types
export type CreateExperimentDto = typeof createExperimentSchema._type;
export type UpdateExperimentDto = typeof updateExperimentSchema._type;
export type ExperimentDto = typeof selectExperimentSchema._type;

// Define experiment status type based on the schema
export type ExperimentStatus = (typeof experimentStatusEnum.enumValues)[number];
export type ExperimentVisibility =
  (typeof experimentVisibilityEnum.enumValues)[number];
