import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

const MIN_QUERY_LENGTH = 2;

/** Searches NCBI Taxonomy by scientific or common name. */
export const useOrganismSearch = (query: string) => {
  const trimmed = query.trim();

  return useQuery(
    orpc.experiments.searchOrganisms.queryOptions({
      input: { query: trimmed },
      enabled: trimmed.length >= MIN_QUERY_LENGTH,
    }),
  );
};
