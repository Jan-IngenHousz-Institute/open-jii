import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { ResourceScope } from "@repo/api/shared/listing";

export const useDatasets = (scope: ResourceScope) => {
  return useQuery(
    orpc.datasets.listDatasets.queryOptions({
      input: { scope },
    }),
  );
};
