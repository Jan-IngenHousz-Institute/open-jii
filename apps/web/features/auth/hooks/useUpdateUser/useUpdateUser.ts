"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to update user
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name?: string; image?: string; registered?: boolean }) => {
      const response = await authClient.updateUser(data);
      return response;
    },
    onSuccess: async (response) => {
      if (response.data) {
        await queryClient.invalidateQueries({ queryKey: ["auth"] });
      }
    },
  });
}
