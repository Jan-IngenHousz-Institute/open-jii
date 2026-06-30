import { getOrpcError, orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

export type UseProtocolCreateOptions = Pick<
  ReturnType<typeof orpc.protocols.createProtocol.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

export const useProtocolCreate = (options: UseProtocolCreateOptions = {}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation(
    orpc.protocols.createProtocol.mutationOptions({
      onSuccess: (...args) => {
        toast({ description: t("protocols.protocolCreated") });
        options.onSuccess?.(...args);
      },
      onError: (...args) => {
        const [error] = args;
        const contractError = getOrpcError(error);

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

        options.onError?.(...args);
      },
      onSettled: async (...args) => {
        await queryClient.invalidateQueries({ queryKey: orpc.protocols.listProtocols.key() });
        options.onSettled?.(...args);
      },
    }),
  );
};
