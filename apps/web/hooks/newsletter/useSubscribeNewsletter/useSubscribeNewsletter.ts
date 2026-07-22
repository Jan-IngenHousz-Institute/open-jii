"use client";

import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/** Directly subscribes the signed-in user's verified email address. */
export function useSubscribeNewsletter() {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.newsletter.subscribeDirect.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.newsletter.getStatus.key() });
      },
    }),
  );
}
