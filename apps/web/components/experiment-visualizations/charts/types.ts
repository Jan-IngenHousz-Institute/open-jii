import type { ComponentType } from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  ChartFamily,
  ChartType,
  DataColumn,
  ExperimentVisualization,
} from "@repo/api/schemas/experiment.schema";

import type { ChartFormConfig, ChartFormDataConfig, ChartFormValues } from "./chart-config";

export interface ChartPanelProps {
  form: UseFormReturn<ChartFormValues>;
  columns: DataColumn[];
  /** Render inline with no Collapsible chrome (for popover-hosted shelves). */
  flat?: boolean;
}

export interface ChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
}

export interface ChartTypeIconProps {
  className?: string;
}

/** Icon for `ShelfDef.icon`; widened past LucideIcon so text glyphs fit too. */
export type ShelfIcon = ComponentType<{ className?: string }>;

/** Translator passed to `ShelfDef.summary` so dynamic previews can stay i18n-clean. */
export type ShelfSummaryT = (key: string, options?: Record<string, unknown>) => string;

/**
 * Declarative single shelf: one axis/encoding (data) or one style section.
 * The dashboard toolbar iterates this list as popovers; the standalone
 * sidebar stacks them with separators.
 */
export interface ShelfDef {
  key: string;
  labelKey: string;
  icon?: ShelfIcon;
  Component: ComponentType<ChartPanelProps>;
  /** Opt the shelf out under the current form state (e.g. combo-only sections). */
  visible?: (form: UseFormReturn<ChartFormValues>) => boolean;
  /** Compact value preview shown on the strip's popover trigger. */
  summary?: (form: UseFormReturn<ChartFormValues>, t: ShelfSummaryT) => string | undefined;
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
  /**
   * Optional shelf descriptors backing the toolbar's per-shelf
   * popovers. When present, the horizontal strip dispatches one popover
   * trigger per shelf instead of one big "Fields" / "Style" popover.
   * Defined per chart type during the migration; the strip falls back
   * to the single-popover DataPanel/StylePanel when omitted.
   */
  dataShelves?: ShelfDef[];
  styleShelves?: ShelfDef[];
}
