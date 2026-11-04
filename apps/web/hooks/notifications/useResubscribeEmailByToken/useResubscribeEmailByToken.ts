import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

/** Undo for the unsubscribe link: the same token, turning the category's email back on. */
export const useResubscribeEmailByToken = () =>
  useMutation(orpc.notifications.resubscribeEmailByToken.mutationOptions());
