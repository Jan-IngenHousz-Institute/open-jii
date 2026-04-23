import type { Protocol } from "@repo/api/schemas/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

import { getContractError, tsr } from "../../../lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "../../../lib/tsr";

const route = tsr.protocols.createProtocol;

export type UseProtocolCreateOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError" | "onSettled"
>;

export const useProtocolCreate = (options: UseProtocolCreateOptions = {}) => {
  const { t } = useTranslation();
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

      const contractError = getContractError(route, error);

      if (!contractError) {
        toast({ description: t("common.errors.serverError"), variant: "destructive" });
        return;
      }

      switch (contractError.status) {
        case 409:
          toast({ description: t("protocols.nameAlreadyExists"), variant: "destructive" });
          break;
        default:
          toast({ description: t("protocols.createError"), variant: "destructive" });
          break;
      }

      options.onError?.(contractError, variables, context, mutation);
    },
    onSettled: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ["protocols"] });
      options.onSettled?.(...args);
    },
  });
};
