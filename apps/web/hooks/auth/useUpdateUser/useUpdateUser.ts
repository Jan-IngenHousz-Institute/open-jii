"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to update user
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name?: string;
      image?: string;
      registered?: boolean;
      email?: string;
    }) => {
      const { email, ...rest } = data;

      if (email) {
        const response = await authClient.changeEmail({ newEmail: email });
        if (response.error) return response;
      }

      if (Object.keys(rest).length > 0) {
        const response = await authClient.updateUser(rest);
        return response;
      }

      return { data: {}, error: null };
    },
    onSuccess: async (response) => {
      if (response.data) {
        await queryClient.invalidateQueries({ queryKey: ["auth"] });
      }
    },
  });
}
