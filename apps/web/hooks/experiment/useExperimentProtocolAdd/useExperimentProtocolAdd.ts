import { tsr } from "@/lib/tsr";

import type { ExperimentProtocol } from "@repo/api";

/**
 * Hook to add protocols to an experiment, bound to a specific experimentId
 * @param experimentId The ID of the experiment
 * @returns Object with addProtocols function and mutation state
 */
export const useExperimentProtocolAdd = (experimentId: string) => {
  const queryClient = tsr.useQueryClient();

  const mutation = tsr.experiments.addExperimentProtocols.useMutation({
    onMutate: async (variables: {
      params: { id: string };
      body: { protocols: { protocolId: string; order?: number }[] };
    }) => {
      await queryClient.cancelQueries({
        queryKey: ["experiment-protocols", experimentId],
      });

      const previousProtocols = queryClient.getQueryData<{ body: Partial<ExperimentProtocol>[] }>([
        "experiment-protocols",
        experimentId,
      ]);

      const optimisticProtocols: Partial<ExperimentProtocol>[] = variables.body.protocols.map(
        (p) => ({
          experimentId,
          order: p.order ?? previousProtocols?.body.length ?? 0,
          addedAt: new Date().toISOString(),
          protocol: {
            id: p.protocolId,
            name: "",
            family: "multispeq",
            createdBy: "",
          },
        }),
      );

      if (previousProtocols?.body) {
        queryClient.setQueryData(["experiment-protocols", experimentId], {
          ...previousProtocols,
          body: [...previousProtocols.body, ...optimisticProtocols],
        });
      }

      return { previousProtocols };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProtocols) {
        queryClient.setQueryData(["experiment-protocols", experimentId], context.previousProtocols);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["experiment-protocols", experimentId],
      });
    },
  });

  const addProtocols = (protocols: { protocolId: string; order?: number }[]) => {
    // Calculate the next order based on the current cache
    const previousProtocols = queryClient.getQueryData<{ body: Partial<ExperimentProtocol>[] }>([
      "experiment-protocols",
      experimentId,
    ]);

    let maxOrder = -1;
    if (previousProtocols?.body.length) {
      maxOrder = Math.max(...previousProtocols.body.map((proto) => proto.order ?? 0));
    }

    // For each protocol, if order is not provided, assign next available order
    const protocolsWithOrder = protocols.map((p, idx) => ({
      ...p,
      order: typeof p.order === "number" ? p.order : maxOrder + 1 + idx,
    }));

    return mutation.mutateAsync({
      params: { id: experimentId },
      body: { protocols: protocolsWithOrder },
    });
  };

  return { ...mutation, addProtocols };
};
