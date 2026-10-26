import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import type { experimentStatusEnum, experimentVisibilityEnum } from "@repo/database";
import { experiments } from "@repo/database";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";

// Create schemas for database operations
export const createExperimentSchema = createInsertSchema(experiments)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
  })
  .extend({
    // Only `userId` is read: everyone picked in the create form gets the
    // read-and-contribute tier, and a per-person tier is chosen afterwards on the
    // collaborators surface.
    members: z
      .array(z.object({ userId: z.string() }))
      .min(1)
      .optional(),
    locations: z
      .array(
        z.object({
          name: z.string(),
          latitude: z.number(),
          longitude: z.number(),
        }),
      )
      .optional(),
  });
export const updateExperimentSchema = createInsertSchema(experiments)
  .partial()
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
  })
  .extend({
    locations: z
      .array(
        z.object({
          name: z.string(),
          latitude: z.number(),
          longitude: z.number(),
        }),
      )
      .optional(),
  });
export const selectExperimentSchema = createSelectSchema(experiments)
  .omit({ searchVector: true })
  .extend({
    ownerFirstName: z.string().nullable().optional(),
    /** Display name of the owning organization; `null` for a personal workspace. */
    organizationName: z.string().nullish(),
    ownerLastName: z.string().nullable().optional(),
    /** Selected by the listing and the access read, absent from the plain column reads. */
    membersCount: z.number().int().optional(),
  });

// Define the types
export type CreateExperimentDto = z.infer<typeof createExperimentSchema>;
export type UpdateExperimentDto = z.infer<typeof updateExperimentSchema>;
export type ExperimentDto = z.infer<typeof selectExperimentSchema>;

export type ExperimentDtoWithData = ExperimentDto & {
  data?: SchemaData;
};

// Define experiment status type based on the schema
export type ExperimentStatus = (typeof experimentStatusEnum.enumValues)[number];
export type ExperimentVisibility = (typeof experimentVisibilityEnum.enumValues)[number];
