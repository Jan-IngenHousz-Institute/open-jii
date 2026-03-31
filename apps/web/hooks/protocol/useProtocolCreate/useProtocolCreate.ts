import type { Protocol } from "@repo/api";

import { isContractError, tsr } from "../../../lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "../../../lib/tsr";

const route = tsr.protocols.createProtocol;

export type UseProtocolCreateOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError" | "onSettled"
>;

export const useProtocolCreate = (props: UseProtocolCreateOptions = {}) => {
  const queryClient = tsr.useQueryClient();

  return route.useMutation({
    ...props,
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
      if (!isContractError(error)) return;
      props.onError?.(error, variables, context, mutation);
    },
    onSettled: async (...args) => {
      await queryClient.invalidateQueries({
        queryKey: ["protocols"],
      });
      props.onSettled?.(...args);
    },
  });
};
