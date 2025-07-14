import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import type { experimentStatusEnum, experimentVisibilityEnum } from "@repo/database";
import { experiments } from "@repo/database";

import type { SchemaData } from "../../../common/services/databricks/databricks.types";

// Create schemas for database operations
export const createExperimentSchema = createInsertSchema(experiments)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
  })
  .extend({
    members: z
      .array(
        z.object({
          userId: z.string(),
          role: z.enum(["admin", "member"]).optional(),
        }),
      )
      .min(1)
      .optional(),
    protocols: z
      .array(z.object({ protocolId: z.string(), order: z.number().optional() }))
      .optional(),
  });
export const updateExperimentSchema = createInsertSchema(experiments).partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
});
export const selectExperimentSchema = createSelectSchema(experiments);

// Define the types
export type CreateExperimentDto = typeof createExperimentSchema._type;
export type UpdateExperimentDto = typeof updateExperimentSchema._type;
export type ExperimentDto = typeof selectExperimentSchema._type;

export type ExperimentDtoWithData = ExperimentDto & {
  data?: SchemaData;
};

// Define experiment status type based on the schema
export type ExperimentStatus = (typeof experimentStatusEnum.enumValues)[number];
export type ExperimentVisibility = (typeof experimentVisibilityEnum.enumValues)[number];
