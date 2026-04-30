import type {
  DashboardLayout,
  DashboardWidget,
} from "@repo/api/schemas/experiment.schema";

/**
 * The shape RHF holds while editing a dashboard. Mirrors the dashboard
 * entity sans server-managed fields (id, timestamps, createdBy). The
 * `widgets` array is driven via `useFieldArray("widgets")`.
 */
export interface DashboardFormValues {
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
}
