import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";

export const useExperimentStandardsFields = (experimentId: string, standard: StandardId) => {
  return useQuery(
    orpc.experiments.getExperimentStandardFields.queryOptions({
      input: { id: experimentId, standard },
    }),
  );
};
