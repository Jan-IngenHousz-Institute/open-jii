import { getOrpcError, orpc } from "@/lib/orpc";
import { parseApiError } from "@/util/apiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@repo/ui/hooks/use-toast";

export type UseDeleteUserOptions = Pick<
  ReturnType<typeof orpc.users.deleteUser.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

/**
 * Soft-deletes the signed-in user's account. Surfaces the API error as a destructive toast itself
 * and invalidates the user/profile caches so any reader refetches. Callers own the success flow
 * (success toast, sign-out, redirect) via onSuccess.
 */
export const useDeleteUser = (options?: UseDeleteUserOptions) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.users.deleteUser.mutationOptions({
      ...options,
      onError: (error, ...rest) => {
        const orpcError = getOrpcError(error);
        toast({ description: parseApiError(error)?.message, variant: "destructive" });
        if (orpcError) {
          options?.onError?.(orpcError, ...rest);
        }
      },
      onSettled: async (...args) => {
        // Ensure any component reading the user profile refetches.
        await queryClient.invalidateQueries({ queryKey: orpc.users.getUserProfile.key() });
        await options?.onSettled?.(...args);
      },
    }),
  );
};
