"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Unsubscribes the signed-in user's email address from the newsletter. */
export function useUnsubscribeNewsletter() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.newsletter.unsubscribe.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.newsletter.getStatus.key() });
      },
    }),
  );
}
