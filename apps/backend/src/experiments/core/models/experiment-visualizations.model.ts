import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  zExperimentChartConfig,
  zExperimentChartDataConfig,
  zExperimentVisualization,
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

export const selectExperimentVisualizationSchema = zExperimentVisualization.extend({
  createdAt: z
    .date()
    .refine(
      (date) => zExperimentVisualization.shape.createdAt.safeParse(date.toISOString()).success,
    ),
  updatedAt: z
    .date()
    .refine(
      (date) => zExperimentVisualization.shape.updatedAt.safeParse(date.toISOString()).success,
    ),
});

// Define the types
export type CreateExperimentVisualizationDto = z.infer<typeof createExperimentVisualizationSchema>;
export type UpdateExperimentVisualizationDto = z.infer<typeof updateExperimentVisualizationSchema>;
export type ExperimentVisualizationDto = z.infer<typeof selectExperimentVisualizationSchema>;
