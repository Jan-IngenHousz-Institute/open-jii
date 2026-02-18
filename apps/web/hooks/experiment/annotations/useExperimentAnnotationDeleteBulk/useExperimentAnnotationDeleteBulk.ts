import { tsr } from "~/lib/tsr";

import type { ExperimentDataResponse } from "@repo/api";

import { useExperimentAnnotationOptimisticUpdate } from "../useExperimentAnnotationOptimisticUpdate/useExperimentAnnotationOptimisticUpdate";

export const useExperimentAnnotationDeleteBulk = () => {
  const queryClient = tsr.useQueryClient();
  const { removeBulk } = useExperimentAnnotationOptimisticUpdate();

  return tsr.experiments.deleteAnnotationsBulk.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["experiment", variables.params.id] });

      // Snapshot the previous value
      const previousData = queryClient.getQueriesData({
        queryKey: ["experiment", variables.params.id],
      });

      // Optimistically update the cache by removing the annotations
      queryClient.setQueriesData(
        { queryKey: ["experiment", variables.params.id] },
        (oldData: { body?: ExperimentDataResponse } | undefined) => {
          // Return early if no data in cache or no experiment data
          if (!oldData?.body?.[0]?.data) return oldData;

          const updatedBody = removeBulk(
            oldData.body,
            variables.body.tableName,
            variables.body.rowIds,
            variables.body.type,
          );

          return { ...oldData, body: updatedBody };
        },
      );

      // Return context object with snapshotted value
      return { previousData };
    },
    onError: async (err, variables, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      // Only refetch on error to restore server state
      await queryClient.invalidateQueries({ queryKey: ["experiment", variables.params.id] });
    },
  });
};
