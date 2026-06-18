import { getContractError, tsr } from "@/lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "@/lib/tsr";
import { parseApiError } from "@/util/apiError";

import { toast } from "@repo/ui/hooks/use-toast";

const route = tsr.sharing.createResourceGrant;

export type UseGrantResourceOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError" | "onSettled"
>;

/** Share a resource (create a grant) and refresh the resource's grant + access caches. */
export const useGrantResource = (options?: UseGrantResourceOptions) => {
  const queryClient = tsr.useQueryClient();

  return route.useMutation({
    ...options,
    onSuccess: (...args) => {
      toast({ description: "Shared" });
      options?.onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      toast({
        description: parseApiError(error)?.message ?? "Failed to share",
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
