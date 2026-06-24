import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import {
  zExperimentChartConfig,
  zExperimentChartDataConfig,
} from "@repo/api/domains/experiment/experiment.schema";
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
    config: zExperimentChartConfig,
    dataConfig: zExperimentChartDataConfig,
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
    config: zExperimentChartConfig,
    dataConfig: zExperimentChartDataConfig,
  });

export const selectExperimentVisualizationSchema = createSelectSchema(
  experimentVisualizations,
).extend({
  config: zExperimentChartConfig,
  dataConfig: zExperimentChartDataConfig,
  createdByName: z.string().optional(),
});

// Define the types
export type CreateExperimentVisualizationDto = typeof createExperimentVisualizationSchema._type;
export type UpdateExperimentVisualizationDto = typeof updateExperimentVisualizationSchema._type;
export type ExperimentVisualizationDto = typeof selectExperimentVisualizationSchema._type;
