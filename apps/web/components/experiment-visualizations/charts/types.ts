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
  /**
   * All plottable columns from the active table (complex types already
   * stripped). Each chart's data-panel further filters per role via
   * `filterColumnsForRole` before passing into individual shelves — that
   * way roles like `z` on a 3D scatter or `labels` on a pie can demand
   * a narrower kind set without changing this surface.
   */
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
  defaultConfig: () => ChartFormConfig;
  defaultDataConfig: (tableName?: string) => ChartFormDataConfig;
  DataPanel: ComponentType<ChartPanelProps>;
  StylePanel: ComponentType<ChartPanelProps>;
  Renderer: ComponentType<ChartRendererProps>;
}
