import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { zDashboardLayout, zDashboardWidget } from "@repo/api/schemas/experiment.schema";
import { experimentDashboards } from "@repo/database";

// Override the JSONB columns with the typed Zod schemas so DTOs flow through
// drizzle with the same shape the API contract expects. Mirrors the pattern
// used by the visualizations model.
export const createExperimentDashboardSchema = createInsertSchema(experimentDashboards)
  .omit({
    id: true,
    experimentId: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
  })
  .extend({
    layout: zDashboardLayout.partial().optional(),
    widgets: z.array(zDashboardWidget).optional(),
  });

export const updateExperimentDashboardSchema = createInsertSchema(experimentDashboards)
  .partial()
  .omit({
    id: true,
    experimentId: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
  })
  .extend({
    layout: zDashboardLayout.partial().optional(),
    widgets: z.array(zDashboardWidget).optional(),
  });

export const selectExperimentDashboardSchema = createSelectSchema(experimentDashboards).extend({
  layout: zDashboardLayout,
  widgets: z.array(zDashboardWidget),
  createdByName: z.string().optional(),
});

export type CreateExperimentDashboardDto = typeof createExperimentDashboardSchema._type;
export type UpdateExperimentDashboardDto = typeof updateExperimentDashboardSchema._type;
export type ExperimentDashboardDto = typeof selectExperimentDashboardSchema._type;
