import { getContractError, tsr } from "@/lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "@/lib/tsr";
import { parseApiError } from "@/util/apiError";

import { toast } from "@repo/ui/hooks/use-toast";

const route = tsr.sharing.revokeResourceGrant;

export type UseRevokeResourceGrantOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError" | "onSettled"
>;

/** Revoke a grant and refresh the resource's grant + access caches. */
export const useRevokeResourceGrant = (options?: UseRevokeResourceGrantOptions) => {
  const queryClient = tsr.useQueryClient();

  return route.useMutation({
    ...options,
    onSuccess: (...args) => {
      toast({ description: "Access removed" });
      options?.onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      toast({
        description: parseApiError(error)?.message ?? "Failed to remove access",
        variant: "destructive",
      });
      const contractError = getContractError(route, error);
      if (contractError) {
        options?.onError?.(contractError, ...rest);
      }
    },
    onSettled: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ["resource-grants"] });
      await queryClient.invalidateQueries({ queryKey: ["resource-access"] });
      options?.onSettled?.(...args);
    },
  });
};
