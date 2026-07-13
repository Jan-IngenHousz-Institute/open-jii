import type { Command } from "@repo/api/schemas/command.schema";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

import { getContractError, tsr } from "../../../lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "../../../lib/tsr";

const route = tsr.commands.createCommand;

export type UseCommandCreateOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError" | "onSettled"
>;

export const useCommandCreate = (options: UseCommandCreateOptions = {}) => {
  const { t } = useTranslation();
  const queryClient = tsr.useQueryClient();

  return route.useMutation({
    ...options,
    onSuccess: (...args) => {
      options.onSuccess?.(...args);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["commands"] });

      const previousCommands = queryClient.getQueryData<{
        body: Command[];
      }>(["commands"]);

      return { previousCommands };
    },
    onError: (error, variables, context, mutation) => {
      if (context?.previousCommands) {
        queryClient.setQueryData(["commands"], context.previousCommands);
      }

      const contractError = getContractError(route, error);

      if (!contractError) {
        toast({ description: t("common.errors.serverError"), variant: "destructive" });
        return;
      }

      switch (contractError.status) {
        case 409:
          toast({ description: t("commands.nameAlreadyExists"), variant: "destructive" });
          break;
        default:
          toast({ description: t("commands.createError"), variant: "destructive" });
          break;
      }

      options.onError?.(contractError, variables, context, mutation);
    },
    onSettled: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ["commands"] });
      options.onSettled?.(...args);
    },
  });
};
