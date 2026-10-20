import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

const MIN_QUERY_LENGTH = 2;

/** Searches Crop Ontology terms by name for describing a column. */
export const useExperimentColumnTermSearch = (query: string) => {
  const trimmed = query.trim();

  return useQuery(
    orpc.experiments.searchColumnTerms.queryOptions({
      input: { query: trimmed },
      enabled: trimmed.length >= MIN_QUERY_LENGTH,
    }),
  );
};
