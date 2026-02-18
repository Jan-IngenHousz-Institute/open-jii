import { tsr } from "~/lib/tsr";

import type { ExperimentDataResponse } from "@repo/api";

import { useExperimentAnnotationOptimisticUpdate } from "../useExperimentAnnotationOptimisticUpdate/useExperimentAnnotationOptimisticUpdate";

export const useExperimentAnnotationAdd = () => {
  const queryClient = tsr.useQueryClient();
  const { update } = useExperimentAnnotationOptimisticUpdate();

  return tsr.experiments.addAnnotation.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["experiment", variables.params.id] });

      // Snapshot the previous value
      const previousData = queryClient.getQueriesData({
        queryKey: ["experiment", variables.params.id],
      });

      // Optimistically update the cache
      queryClient.setQueriesData(
        { queryKey: ["experiment", variables.params.id] },
        (oldData: { body?: ExperimentDataResponse } | undefined) => {
          // Return early if no data in cache or no experiment data
          if (!oldData?.body?.[0]?.data) return oldData;

          const updatedBody = update(
            oldData.body,
            variables.body.tableName,
            [variables.body.rowId],
            variables.body.annotation,
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
