import { tsr } from "@/lib/tsr";
import { parseApiError } from "@/util/apiError";

import { toast } from "@repo/ui/hooks/use-toast";

function refresh(queryClient: ReturnType<typeof tsr.useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["public-organizations"] }),
    queryClient.invalidateQueries({ queryKey: ["organization"] }),
    queryClient.invalidateQueries({ queryKey: ["organization-join-requests"] }),
  ]);
}

/** Request to join a public organization. */
export const useRequestToJoin = () => {
  const queryClient = tsr.useQueryClient();
  return tsr.organizations.requestToJoin.useMutation({
    onSuccess: () => toast({ description: "Request sent" }),
    onError: (error) =>
      toast({
        description: parseApiError(error)?.message ?? "Failed to send request",
        variant: "destructive",
      }),
    onSettled: () => refresh(queryClient),
  });
};

/** Approve a pending join request (owner/admin). */
export const useApproveJoinRequest = () => {
  const queryClient = tsr.useQueryClient();
  return tsr.organizations.approveJoinRequest.useMutation({
    onSuccess: () => toast({ description: "Request approved" }),
    onError: (error) =>
      toast({
        description: parseApiError(error)?.message ?? "Failed to approve",
        variant: "destructive",
      }),
    onSettled: () => refresh(queryClient),
  });
};

/** Reject a pending join request (owner/admin). */
export const useRejectJoinRequest = () => {
  const queryClient = tsr.useQueryClient();
  return tsr.organizations.rejectJoinRequest.useMutation({
    onSuccess: () => toast({ description: "Request rejected" }),
    onError: (error) =>
      toast({
        description: parseApiError(error)?.message ?? "Failed to reject",
        variant: "destructive",
      }),
    onSettled: () => refresh(queryClient),
  });
};

/** Cancel your own pending join request. */
export const useCancelJoinRequest = () => {
  const queryClient = tsr.useQueryClient();
  return tsr.organizations.cancelJoinRequest.useMutation({
    onSuccess: () => toast({ description: "Request cancelled" }),
    onError: (error) =>
      toast({
        description: parseApiError(error)?.message ?? "Failed to cancel",
        variant: "destructive",
      }),
    onSettled: () => refresh(queryClient),
  });
};
