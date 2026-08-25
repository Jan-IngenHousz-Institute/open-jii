import { orpc } from "@/lib/orpc";
import type { QueryKey } from "@tanstack/react-query";

/**
 * Every list consumer — overview pages, pickers, dashboard, IoT surfaces —
 * reads the same list procedure per entity (paginated or not is just input),
 * so one key covers all of them. Centralized so no mutation call site
 * invalidates a partial set.
 */
export const listQueryKeys = {
  experiments: (): QueryKey[] => [orpc.experiments.listExperiments.key()],
  protocols: (): QueryKey[] => [orpc.protocols.listProtocols.key()],
  macros: (): QueryKey[] => [orpc.macros.listMacros.key()],
  workbooks: (): QueryKey[] => [orpc.workbooks.listWorkbooks.key()],
} as const;
