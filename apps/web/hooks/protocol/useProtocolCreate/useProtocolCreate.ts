import type { Protocol } from "@repo/api";

import { contract, tsr } from "../../../lib/tsr";
import type { ContractErrorResponse, TsRestMutationOptions } from "../../../lib/tsr";

export type UseProtocolCreateOptions = TsRestMutationOptions<
  typeof contract.protocols.createProtocol,
  "onSuccess" | "onError" | "onSettled"
>;

export const useProtocolCreate = (props: UseProtocolCreateOptions = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.protocols.createProtocol.useMutation({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["protocols"] });

      const previousProtocols = queryClient.getQueryData<{
        body: Protocol[];
      }>(["protocols"]);

      return { previousProtocols };
    },
    onError: (error, variables, context, mutation) => {
      if (context?.previousProtocols) {
        queryClient.setQueryData(["protocols"], context.previousProtocols);
      }
      if (error instanceof Error) return;
      const apiError = error as ContractErrorResponse<typeof contract.protocols.createProtocol>;
      props.onError?.(apiError, variables, context, mutation);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["protocols"],
      });
    },
    onSuccess: (...args) => {
      props.onSuccess?.(...args);
    },
  });
};
