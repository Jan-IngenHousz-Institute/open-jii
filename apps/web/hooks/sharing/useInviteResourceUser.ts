import { getContractError, tsr } from "@/lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "@/lib/tsr";
import { parseApiError } from "@/util/apiError";

import { toast } from "@repo/ui/hooks/use-toast";

const route = tsr.sharing.inviteResourceUser;

export type UseInviteResourceUserOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError" | "onSettled"
>;

/** Invite a person by email (no account needed) to a resource; refresh grants. */
export const useInviteResourceUser = (options?: UseInviteResourceUserOptions) => {
  const queryClient = tsr.useQueryClient();

  return route.useMutation({
    ...options,
    onSuccess: (...args) => {
      toast({ description: "Invitation sent" });
      options?.onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      toast({
        description: parseApiError(error)?.message ?? "Failed to send invitation",
        variant: "destructive",
      });
      const contractError = getContractError(route, error);
      if (contractError) {
        options?.onError?.(contractError, ...rest);
      }
    },
    onSettled: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ["resource-grants"] });
      options?.onSettled?.(...args);
    },
  });
};
