// Import the SampleTable type from the API
import type { SampleTable as ApiSampleTable } from "@/hooks/experiment/useExperimentData/useExperimentData";
import type { UseFormReturn } from "react-hook-form";

import type { CreateExperimentVisualizationBody } from "@repo/api";

import type { ChartConfig } from "../types/chart-config-types";

// Export chart configuration types for reuse
export * from "../types/chart-config-types";

// Form schema type definition for chart configurators
// This should match the API schema structure but with properly typed config
export interface ChartFormValues extends Omit<CreateExperimentVisualizationBody, "config"> {
  config: ChartConfig;
}

// Backward compatibility for existing code
export type ChartFormValuesLegacy = CreateExperimentVisualizationBody;

// Reexport API's SampleTable type to use it in our components
export type SampleTable = ApiSampleTable;

// Interface for chart configurator components
export interface ChartConfiguratorComponentProps {
  form: UseFormReturn<ChartFormValues>;
  table: SampleTable;
  onColumnSelect: (columnType: string, columnName: string) => void;
}
