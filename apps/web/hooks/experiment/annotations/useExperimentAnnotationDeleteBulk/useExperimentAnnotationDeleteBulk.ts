import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "~/lib/orpc";

import type { ExperimentDataResponse } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { useExperimentAnnotationOptimisticUpdate } from "../useExperimentAnnotationOptimisticUpdate/useExperimentAnnotationOptimisticUpdate";

export const useExperimentAnnotationDeleteBulk = () => {
  const queryClient = useQueryClient();
  const { removeBulk } = useExperimentAnnotationOptimisticUpdate();

  const dataKey = orpc.experiments.getExperimentData.key();

  return useMutation(
    orpc.experiments.deleteAnnotationsBulk.mutationOptions({
      onMutate: async (variables) => {
        await queryClient.cancelQueries({ queryKey: dataKey });

        const previousData = queryClient.getQueriesData<ExperimentDataResponse>({
          queryKey: dataKey,
        });

        queryClient.setQueriesData<ExperimentDataResponse>({ queryKey: dataKey }, (oldData) => {
          if (!oldData?.[0]?.data) return oldData;

          return removeBulk(oldData, variables.tableName, variables.rowIds, variables.type);
        });

        return { previousData };
      },
      onError: async (_err, _variables, context) => {
        if (context?.previousData) {
          context.previousData.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data);
          });
        }
        await queryClient.invalidateQueries({ queryKey: dataKey });
      },
    }),
  );
};
