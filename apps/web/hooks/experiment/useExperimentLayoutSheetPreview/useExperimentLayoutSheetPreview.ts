import { orpc } from "@/lib/orpc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

/** Counts what matching a sheet by plot would do before it is saved. */
export const useExperimentLayoutSheetPreview = (experimentId: string, identifiers: string[]) => {
  return useQuery(
    orpc.experiments.previewLayoutSheetMatch.queryOptions({
      input: { id: experimentId, identifiers },
      enabled: identifiers.length > 0,
      placeholderData: keepPreviousData,
    }),
  );
};
