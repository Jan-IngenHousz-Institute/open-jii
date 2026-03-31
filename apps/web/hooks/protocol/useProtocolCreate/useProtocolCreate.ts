import type { Protocol } from "@repo/api";

import { isContractError, tsr } from "../../../lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "../../../lib/tsr";
import { toast } from "@repo/ui/hooks";
import { t } from "@repo/i18n";

const route = tsr.protocols.createProtocol;

export type UseProtocolCreateOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError" | "onSettled"
>;

export const useProtocolCreate = (options: UseProtocolCreateOptions = {}) => {
  const queryClient = tsr.useQueryClient();

  return route.useMutation({
    ...options,
    onSuccess: (...args) => {
      toast({ description: t("protocols.protocolCreated") });
      options.onSuccess?.(...args);
    },
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

      switch(error.status) {
        case 409:
          toast({ description: t("protocols.nameAlreadyExists"), variant: "destructive" });
          break;
        default:
        case 400:
          toast({ description: t("protocols.createError"), variant: "destructive" });
          break;
      }

      options.onError?.(error, variables, context, mutation);
    },
    onSettled: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ["protocols"] });
      options.onSettled?.(...args);
    },
  });
};
