import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { zChartConfig, zChartDataConfig } from "@repo/api";
import { experimentVisualizations } from "@repo/database";

// Create schemas for database operations
export const createExperimentVisualizationSchema = createInsertSchema(experimentVisualizations)
  .omit({
    id: true,
    experimentId: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
  })
  .extend({
    config: zChartConfig,
    dataConfig: zChartDataConfig,
  });

export const updateExperimentVisualizationSchema = createInsertSchema(experimentVisualizations)
  .partial()
  .omit({
    id: true,
    experimentId: true,
    createdAt: true,
    updatedAt: true,
    createdBy: true,
  })
  .extend({
    config: zChartConfig,
    dataConfig: zChartDataConfig,
  });

export const selectExperimentVisualizationSchema = createSelectSchema(
  experimentVisualizations,
).extend({
  config: zChartConfig,
  dataConfig: zChartDataConfig,
});

// Define the types
export type CreateExperimentVisualizationDto = typeof createExperimentVisualizationSchema._type;
export type UpdateExperimentVisualizationDto = typeof updateExperimentVisualizationSchema._type;
export type ExperimentVisualizationDto = typeof selectExperimentVisualizationSchema._type;
