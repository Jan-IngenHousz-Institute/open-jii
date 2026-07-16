import { z } from "zod";

import {
  zExperimentDataFilter,
  zExperimentDataFilterOperator,
  zExperimentDataFilterValue,
} from "../data/experiment-data.schema";

export const zExperimentWidgetLayout = z.object({
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  colSpan: z.number().int().min(1).max(24),
  rowSpan: z.number().int().min(1).max(48),
});

const zWidgetBase = z.object({
  id: z.string().uuid(),
  layout: zExperimentWidgetLayout,
});

export const zExperimentVisualizationWidget = zWidgetBase.extend({
  type: z.literal("visualization"),
  config: z.object({
    visualizationId: z.string().uuid().optional(),
    showTitle: z.boolean().optional().default(true),
    showDescription: z.boolean().optional().default(false),
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const zExperimentRichTextWidget = zWidgetBase.extend({
  type: z.literal("richText"),
  config: z.object({
    html: z.string().default(""),
  }),
});

export const zExperimentTableWidget = zWidgetBase.extend({
  type: z.literal("table"),
  config: z.object({
    tableName: z.string().optional(),
    columns: z.array(z.string().min(1)).optional(),
    pageSize: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]).default(25),
    title: z.string().optional(),
    description: z.string().optional(),
    showTitle: z.boolean().optional().default(true),
    showDescription: z.boolean().optional().default(true),
    // AND-merged with dashboard-level filter widgets targeting the same table.
    filters: z.array(zExperimentDataFilter).optional(),
  }),
});

// Single-column control card; AND-merges into widgets whose `tableName` matches.
export const zExperimentFilterWidget = zWidgetBase.extend({
  type: z.literal("filter"),
  config: z.object({
    tableName: z.string().optional(),
    column: z.string().optional(),
    operator: zExperimentDataFilterOperator.optional(),
    defaultValue: zExperimentDataFilterValue.optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    showTitle: z.boolean().optional().default(true),
    showDescription: z.boolean().optional().default(true),
  }),
});

export const zExperimentDashboardWidget = z.discriminatedUnion("type", [
  zExperimentVisualizationWidget,
  zExperimentRichTextWidget,
  zExperimentTableWidget,
  zExperimentFilterWidget,
]);

export const zExperimentDashboardLayout = z.object({
  columns: z.number().int().min(1).max(24).default(12),
  rowHeight: z.number().int().min(20).max(400).default(80),
  gap: z.number().int().min(0).max(64).default(16),
});

export const zExperimentDashboard = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  layout: zExperimentDashboardLayout,
  widgets: z.array(zExperimentDashboardWidget),
  createdBy: z.string().uuid(),
  createdByName: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zExperimentDashboardList = z.array(zExperimentDashboard);

export const zCreateExperimentDashboardBody = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  layout: zExperimentDashboardLayout.partial().optional(),
  widgets: z.array(zExperimentDashboardWidget).optional(),
});

export const zUpdateExperimentDashboardBody = zCreateExperimentDashboardBody.partial();

export const zListExperimentDashboardsQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const zExperimentDashboardPathParam = z.object({
  id: z.string().uuid().describe("ID of the experiment"),
  dashboardId: z.string().uuid().describe("ID of the dashboard"),
});

export const zCreateExperimentDashboardResponse = zExperimentDashboard;
export const zUpdateExperimentDashboardResponse = zExperimentDashboard;

export type ExperimentWidgetLayout = z.infer<typeof zExperimentWidgetLayout>;
export type ExperimentVisualizationWidget = z.infer<typeof zExperimentVisualizationWidget>;
export type ExperimentRichTextWidget = z.infer<typeof zExperimentRichTextWidget>;
export type ExperimentTableWidget = z.infer<typeof zExperimentTableWidget>;
export type ExperimentFilterWidget = z.infer<typeof zExperimentFilterWidget>;
export type ExperimentDashboardWidget = z.infer<typeof zExperimentDashboardWidget>;
export type ExperimentDashboardLayout = z.infer<typeof zExperimentDashboardLayout>;
export type ExperimentDashboard = z.infer<typeof zExperimentDashboard>;
export type ExperimentDashboardList = z.infer<typeof zExperimentDashboardList>;
export type CreateExperimentDashboardBody = z.infer<typeof zCreateExperimentDashboardBody>;
export type UpdateExperimentDashboardBody = z.infer<typeof zUpdateExperimentDashboardBody>;
export type ListExperimentDashboardsQuery = z.infer<typeof zListExperimentDashboardsQuery>;
