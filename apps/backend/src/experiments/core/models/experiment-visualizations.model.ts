import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import {
  zExperimentChartConfig,
  zExperimentChartDataConfig,
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
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
export type CreateExperimentVisualizationDto = z.infer<typeof createExperimentVisualizationSchema>;
export type UpdateExperimentVisualizationDto = z.infer<typeof updateExperimentVisualizationSchema>;
export type ExperimentVisualizationDto = z.infer<typeof selectExperimentVisualizationSchema>;
