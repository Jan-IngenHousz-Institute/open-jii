import type { ComponentType } from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  ChartFamily,
  ChartType,
  DataColumn,
  ExperimentVisualization,
} from "@repo/api/schemas/experiment.schema";

import type { ChartFormConfig, ChartFormDataConfig, ChartFormValues } from "./form-values";

export interface ChartPanelProps {
  form: UseFormReturn<ChartFormValues>;
  columns: DataColumn[];
}

export interface ChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
}

export interface ChartTypeIconProps {
  className?: string;
}

export interface ChartTypeDef {
  type: ChartType;
  family: ChartFamily;
  labelKey: string;
  descriptionKey: string;
  icon: ComponentType<ChartTypeIconProps>;
  /** Roles that must be configured before the canvas attempts to render. */
  requiredRoles: readonly string[];
  defaultConfig: () => ChartFormConfig;
  defaultDataConfig: (tableName?: string) => ChartFormDataConfig;
  DataPanel: ComponentType<ChartPanelProps>;
  StylePanel: ComponentType<ChartPanelProps>;
  Renderer: ComponentType<ChartRendererProps>;
}
