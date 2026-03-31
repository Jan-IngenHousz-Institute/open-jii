import type { Protocol } from "@repo/api";

import { isContractError, tsr } from "../../../lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "../../../lib/tsr";

export type UseProtocolCreateOptions = TsRestMutationOptions<
  TsrRoute<typeof tsr.protocols.createProtocol>,
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
      if (!isContractError(tsr.protocols.createProtocol, error)) return;
      props.onError?.(error, variables, context, mutation);
    },
    onSettled: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: ["protocols"],
      });
      props.onSettled?.(...args);
    },
    onSuccess: (...args) => {
      props.onSuccess?.(...args);
    },
  });
};
