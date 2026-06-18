import { getContractError, tsr } from "@/lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "@/lib/tsr";
import { parseApiError } from "@/util/apiError";

import { toast } from "@repo/ui/hooks/use-toast";

const route = tsr.users.deleteUser;

export type UseDeleteUserOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError" | "onSettled"
>;

/**
 * Soft-deletes the signed-in user's account. Surfaces the API error as a destructive toast itself
 * and invalidates the user/profile caches so any reader refetches. Callers own the success flow
 * (success toast, sign-out, redirect) via onSuccess.
 */
export const useDeleteUser = (options?: UseDeleteUserOptions) => {
  const queryClient = tsr.useQueryClient();

  return route.useMutation({
    ...options,
    onError: (error, ...rest) => {
      toast({ description: parseApiError(error)?.message, variant: "destructive" });
      const contractError = getContractError(route, error);
      if (contractError) {
        options?.onError?.(contractError, ...rest);
      }
    },
    onSettled: async (...args) => {
      // Ensure any component reading the user or userProfile refetches.
      await queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      await queryClient.invalidateQueries({ queryKey: ["user"] });
      await options?.onSettled?.(...args);
    },
  });
};
