import { orpc } from "@/lib/orpc";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const MIN_QUERY_LENGTH = 2;

/** Searches the Common Greenhouse Ontology by name for a term to tag a unit name with. */
export const useExperimentLayoutTermSearch = (query: string) => {
  const trimmed = query.trim();

  return useQuery(
    orpc.experiments.searchLayoutTerms.queryOptions({
      input: { query: trimmed },
      enabled: trimmed.length >= MIN_QUERY_LENGTH,
      placeholderData: keepPreviousData,
    }),
  );
};
