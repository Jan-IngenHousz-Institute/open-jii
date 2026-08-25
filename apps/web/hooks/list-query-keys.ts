import { orpc } from "@/lib/orpc";
import type { QueryKey } from "@tanstack/react-query";

/**
 * Overview pages read the paginated list procedures while pickers, the
 * dashboard, and IoT surfaces still read the unpaginated ones. oRPC keys carry
 * the full procedure path, so invalidating one sibling never reaches the other;
 * the pair lives here so no mutation call site can cover only one.
 */
export const listQueryKeys = {
  experiments: (): QueryKey[] => [
    orpc.experiments.listExperiments.key(),
    orpc.experiments.listExperimentsPaginated.key(),
  ],
  protocols: (): QueryKey[] => [
    orpc.protocols.listProtocols.key(),
    orpc.protocols.listProtocolsPaginated.key(),
  ],
  macros: (): QueryKey[] => [orpc.macros.listMacros.key(), orpc.macros.listMacrosPaginated.key()],
  workbooks: (): QueryKey[] => [
    orpc.workbooks.listWorkbooks.key(),
    orpc.workbooks.listWorkbooksPaginated.key(),
  ],
} as const;
