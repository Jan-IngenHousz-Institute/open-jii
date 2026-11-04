import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

/** The token is the only credential, so nothing is scoped to a principal and no cache is written. */
export const useUnsubscribeEmailByToken = () =>
  useMutation(orpc.notifications.unsubscribeEmailByToken.mutationOptions());
